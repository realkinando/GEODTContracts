pragma solidity ^0.6.8;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GEODT {

    IUniswapV2Router02 constant public ROUTER = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    IERC20 public dai;
    IERC20 public WETH;
    address[] public path;

    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
        address verifyingContract;
    }

    struct MetaTransaction {
		uint256 nonce;
		address from;
        uint daiAmount;
        uint minEth;
        uint deadline;
    }

    mapping(address => uint256) public nonces;
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
    keccak256(bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));

    bytes32 internal constant META_TRANSACTION_TYPEHASH =
    keccak256(bytes("MetaTransaction(uint256 nonce,address from,uint daiAmount,uint minEth,uint deadline)"));
    bytes32 internal DOMAIN_SEPARATOR = keccak256(abi.encode(
        EIP712_DOMAIN_TYPEHASH,
		keccak256(bytes("GEODT")),
		keccak256(bytes("1")),
		42, // Kovan
		address(this)
    ));

    constructor(address daiAddress,address WETHAddress) public{
        dai = IERC20(daiAddress);
        path = [daiAddress,WETHAddress];
        dai.approve(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D,2**256-1);
    }

    function getEth(address userAddress, uint daiA, uint mEth, uint deadl, bytes32 r, bytes32 s, uint8 v) external {
        MetaTransaction memory metaTx = MetaTransaction({
            nonce: nonces[userAddress],
            from: userAddress,
            daiAmount: daiA,
            minEth: mEth,
            deadline: deadl
        });

        bytes32 digest = keccak256(
            abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(abi.encode(META_TRANSACTION_TYPEHASH, metaTx.nonce, metaTx.from, metaTx.daiAmount, metaTx.minEth,
                    metaTx.deadline))
                )
            );

        require(userAddress != address(0), "invalid-address-0");
        require(userAddress == ecrecover(digest, v, r, s), "invalid-signatures");
        nonces[userAddress]++;
        uint256 castedAmount = uint256(daiA);
        require(dai.transferFrom(userAddress, address(this), castedAmount),"Dai from User to GEODT failed");
        try ROUTER.swapExactTokensForETH(daiA, mEth, path, userAddress, deadl) {}
        catch (bytes memory reason){
            revert("swap call failed");
        }
    }

}