import type {
  AbiFragment,
  AbiFunctionFragment,
  ContractAbi,
  HexString,
  Mutable,
  Web3,
  Web3Context,
  Web3ValidationErrorObject,
  MatchPrimitiveType,
  Address,
  ContractInitOptions,
} from "web3";
import { Contract, Web3PluginBase, validator as Validator, eth } from "web3";
import type {
  NonPayableMethodObject,
  PayableMethodObject,
  ContractMethodsInterface,
} from "web3-eth-contract";

import { multicallAbi } from "./abis";

const {
  encodeFunctionSignature,
  isAbiFunctionFragment,
  jsonInterfaceMethodToString,
} = eth.abi;

const { decodeMethodReturn } = eth.contract;

const { validator, Web3ValidatorError } = Validator;

const DEFAULT_MULTICALL_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const MethodAbi = Symbol("MethodAbi");
const ContractAddress = Symbol("ContractAddress");

type PayableMethodCallType<T> = T extends PayableMethodObject<
  unknown,
  infer Outputs
>
  ? Outputs
  : never;

type NonPayableMethodCallType<T> = T extends NonPayableMethodObject<
  unknown,
  infer Outputs
>
  ? Outputs
  : never;

type CallType<T> = PayableMethodCallType<T> extends MatchPrimitiveType<
  infer _A,
  infer _B
>
  ? PayableMethodCallType<T>
  : PayableMethodCallType<T> extends
      | string
      | boolean
      | number
      | object
      | unknown[]
  ? PayableMethodCallType<T>
  : NonPayableMethodCallType<T>;

export type MulticallConfig<T> = { allowFailure: boolean } & (
  | {
      allowFailure: true;
      defaultValue: T;
    }
  | { allowFailure: false }
);

export class MulticallPlugin extends Web3PluginBase {
  private readonly contract: Contract<typeof multicallAbi>;

  public pluginNamespace = "multicall";

  /**
   *
   * @param multicallAddress Address of the multicall contract. Set to `DEFAULT_MULTICALL_ADDRESS` by default.
   */
  constructor(multicallAddress: string = DEFAULT_MULTICALL_ADDRESS) {
    super();

    this.contract = new Contract<typeof multicallAbi>(
      multicallAbi,
      multicallAddress,
    );
  }

  public link(parentContext: Web3Context): void {
    super.link(parentContext);
    const web3 = parentContext as Web3;

    class UpdatedContract<Abi extends ContractAbi> extends web3.eth
      .Contract<Abi> {
      public constructor(
        jsonInterface: Abi,
        addressOrOptions?: Address | ContractInitOptions,
        options?: ContractInitOptions,
      ) {
        // @ts-ignore
        super(jsonInterface, addressOrOptions, options);

        const functionsAbi = jsonInterface.filter(
          (abi) => abi.type !== "error",
        );

        for (const a of functionsAbi) {
          const abi: Mutable<AbiFragment & { signature: HexString }> = {
            ...a,
            signature: "",
          };

          if (isAbiFunctionFragment(abi)) {
            const methodName = jsonInterfaceMethodToString(abi);
            const methodSignature = encodeFunctionSignature(methodName);
            abi.signature = methodSignature;

            abi.constant =
              abi.stateMutability === "view" ??
              abi.stateMutability === "pure" ??
              abi.constant;

            abi.payable = abi.stateMutability === "payable" ?? abi.payable;

            // @ts-ignore
            const abiFragment = this._overloadedMethodAbis.get(abi.name) ?? [];

            const byAbiName = this.methods[abi.name];

            // @ts-ignore
            this.methods[abi.name as keyof ContractMethodsInterface<Abi>] = (
              ...args
            ) => ({
              ...byAbiName(...args),
              [MethodAbi]: abiFragment,
              [ContractAddress]: this.options.address,
            });

            const byMethodName = this.methods[methodName];
            // @ts-ignore
            this.methods[methodName as keyof ContractMethodsInterface<Abi>] = (
              ...args
            ) => ({
              ...byMethodName(...args),
              [MethodAbi]: abiFragment,
              [ContractAddress]: this.options.address,
            });

            const bySignature = this.methods[methodSignature];
            // @ts-ignore
            this.methods[
              methodSignature as keyof ContractMethodsInterface<Abi>
            ] = (...args) => ({
              ...bySignature(...args),
              [MethodAbi]: abiFragment,
              [ContractAddress]: this.options.address,
            });
          }
        }
      }
    }

    // @ts-ignore
    web3.eth.Contract = UpdatedContract;
    this.contract.link(parentContext);
  }

  /**
   * Performs multicall
   * @param methods Methods to call
   * @param params Multicall parameters
   */
  public async makeMulticall<
    T extends
      | readonly (
          | PayableMethodObject<any, any>
          | NonPayableMethodObject<any, any>
        )[]
      | [],
    K,
  >(
    methods: T,
    params: MulticallConfig<K> = { allowFailure: false },
  ): Promise<{ -readonly [P in keyof T]: CallType<T[P]> }> {
    if (!methods) {
      return [] as { -readonly [P in keyof T]: CallType<T[P]> };
    }

    const calls = methods.map((x) => ({
      // @ts-ignore
      target: x[ContractAddress],
      callData: x.encodeABI(),
      allowFailure: params.allowFailure,
    }));

    const mutlicallResult = await this.contract.methods
      .aggregate3(calls)
      .call();

    const abis = this.getAbis(methods);

    const parsedResult = mutlicallResult.map((x, i) => {
      if (x.success) {
        return decodeMethodReturn(abis[i], x.returnData.toString());
      }

      if (!params.allowFailure) {
        throw new Error("Unreachable");
      }

      return params.defaultValue;
    });

    return parsedResult as { -readonly [P in keyof T]: CallType<T[P]> };
  }

  private getAbis<
    T extends
      | readonly (
          | PayableMethodObject<any, any>
          | NonPayableMethodObject<any, any>
        )[]
      | [],
  >(methods: T): AbiFunctionFragment[] {
    const abis: AbiFunctionFragment[] = [];
    for (const method of methods) {
      // @ts-ignore
      const methodAbis: AbiFunctionFragment[] = method[MethodAbi].filter(
        (x: AbiFunctionFragment) =>
          x.inputs!.length === method.arguments.length,
      );

      if (!methodAbis.length) {
        throw new Error("Unable to find corresponding method");
      }

      const errors: Web3ValidationErrorObject[] = [];
      // @ts-ignore
      let methodAbi = methodAbis[0];
      for (const overload of methodAbis) {
        try {
          validator.validate(overload.inputs!, method.arguments as unknown[]);
          methodAbi = overload;
          break;
        } catch (e) {
          errors.push(e as Web3ValidationErrorObject);
        }
      }

      if (errors.length === methodAbis.length) {
        throw new Web3ValidatorError(errors);
      }

      abis.push(methodAbi);
    }

    return abis;
  }
}

declare module "web3" {
  interface Web3Context {
    multicall: MulticallPlugin;
  }
}
