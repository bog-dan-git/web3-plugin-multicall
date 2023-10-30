// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TestMulticall {
    struct Person {
        string firstName;
        string lastName;
        address addr;
    }

    uint256[] data = [1,2,3,4,5];


    function add(uint256 a, uint256 b) external pure returns (uint256) {
        return a + b;
    }

    function add(uint256 a, uint256 b, uint256 c) external pure returns(uint256) {
        return a + b + c;
    }

    function returnValue(bytes calldata _data) external pure returns(bytes calldata) {
        return _data;
    }

    function getHello() external pure returns(string memory) {
        return "Hello";
    }

    function getUint256Array() external view returns(uint256[] memory) {
        return data;
    }

    function getPerson() external pure returns(Person memory) {
        Person memory p;
        p.firstName = "Marcus";
        p.lastName = "Aurelius";
        p.addr = address(0);

        return p;
    }

    function instantRevert() external pure returns(uint256) {
        revert("Reason");
    }
}
