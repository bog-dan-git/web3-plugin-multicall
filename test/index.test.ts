import assert from "assert";
import { HttpProvider, Web3 } from "web3";
import { MulticallPlugin } from "../src";
import { testMulticallAbi } from "./abis";

const MULTICALL_ADDRESS = "";
const TEST_MULITCALL_ADDRESS = "";
const RPC_URL = "http://127.0.0.1:7545";

describe("Multicall Plugin Tests", () => {
  it("should register Multicall plugin on Web3Context instance", () => {
    const web3Context = new Web3(new HttpProvider(RPC_URL));
    web3Context.registerPlugin(new MulticallPlugin(MULTICALL_ADDRESS));
    expect(web3Context.multicall).toBeDefined();
  });

  describe("Multicall Plugin method tests", () => {
    let web3: Web3;
    beforeAll(() => {
      web3 = new Web3(new HttpProvider(RPC_URL));
      web3.registerPlugin(new MulticallPlugin(MULTICALL_ADDRESS));
    });

    it("Should call single contract", async () => {
      const contract = new web3.eth.Contract(
        testMulticallAbi,
        TEST_MULITCALL_ADDRESS,
      );

      const [sum1, sum2, hello, person] = await web3.multicall.makeMulticall([
        contract.methods.add(3, 5),
        contract.methods.add(3, 4, 5),
        contract.methods.getHello(),
        contract.methods.getPerson(),
      ]);

      assert.equal(BigInt(sum1), 8n);
      assert.equal(BigInt(sum2), 12n);
      assert.equal(hello, "Hello");

      assert.deepEqual(
        {
          firstName: person.firstName.toString(),
          lastName: person.lastName.toString(),
          addr: person.addr,
        },
        {
          firstName: "Marcus",
          lastName: "Aurelius",
          addr: "0x0000000000000000000000000000000000000000",
        },
      );
    });
    it("Should throw if failure is not allowed", async () => {
      const contract = new web3.eth.Contract(
        testMulticallAbi,
        TEST_MULITCALL_ADDRESS,
      );

      await assert.rejects(
        async () =>
          await web3.multicall.makeMulticall(
            [contract.methods.getValue(), contract.methods.instantRevert()],
            { allowFailure: false },
          ),
      );
    });

    it("Should return default value if failure is allowed", async () => {
      const contract = new web3.eth.Contract(
        testMulticallAbi,
        TEST_MULITCALL_ADDRESS,
      );

      const [sum, value] = await web3.multicall.makeMulticall(
        [contract.methods.add(3, 5), contract.methods.instantRevert()],
        { allowFailure: true, defaultValue: -1 },
      );

      assert.equal(sum, 8);
      assert.equal(value, -1);
    });

    it("Shouldn't break existing contracts", async () => {
      const contract = new web3.eth.Contract(
        testMulticallAbi,
        TEST_MULITCALL_ADDRESS,
      );

      const [sum1, sum2, hello, person] = await Promise.all([
        contract.methods.add(3, 5).call(),
        contract.methods.add(3, 4, 5).call(),
        contract.methods.getHello().call(),
        contract.methods.getPerson().call(),
      ]);

      assert.equal(BigInt(sum1), 8n);
      assert.equal(BigInt(sum2), 12n);
      assert.equal(hello, "Hello");

      assert.deepEqual(
        {
          firstName: person.firstName.toString(),
          lastName: person.lastName.toString(),
          addr: person.addr,
        },
        {
          firstName: "Marcus",
          lastName: "Aurelius",
          addr: "0x0000000000000000000000000000000000000000",
        },
      );
    });
  });
});
