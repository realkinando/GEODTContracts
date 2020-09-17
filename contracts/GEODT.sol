pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GEODT {

    address constant public routerAddress = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    address public WETH;
    
    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
        address verifyingContract;
    }

    struct MetaTransaction {
		uint256 nonce;
		address from;
        address token;
        uint tokenAmount;
        uint minEth;
        uint deadline;
    }

    mapping(address => uint256) public nonces;
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
    keccak256(bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));

    bytes32 internal constant META_TRANSACTION_TYPEHASH =
    keccak256(bytes("MetaTransaction(uint256 nonce,address from,address token,uint tokenAmount,uint minEth,uint deadline)"));
    bytes32 internal DOMAIN_SEPARATOR = keccak256(abi.encode(
        EIP712_DOMAIN_TYPEHASH,
		keccak256(bytes("GEODT")),
		keccak256(bytes("1")),
		42, // Kovan, change when deploying
		address(this)
    ));

    constructor(address _WETH) public{
        WETH = _WETH;
    }

    function getEth(MetaTransaction calldata metaTx, bytes32 r, bytes32 s, uint8 v) external {

        bytes32 digest = keccak256(
            abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(abi.encode(META_TRANSACTION_TYPEHASH, metaTx.nonce, metaTx.from, metaTx.token,
                    metaTx.tokenAmount, metaTx.minEth,metaTx.deadline))
                )
            );
        require(metaTx.from != address(0), "invalid-address-0");
        require(metaTx.from == ecrecover(digest, v, r, s), "invalid-signatures");
        nonces[metaTx.from]++;
        address[] memory path = new address[](2);
        path[0] = metaTx.token;
        path[1] = WETH;
        uint256 castedAmount = uint256(metaTx.tokenAmount);
        IERC20 TOKEN = IERC20(metaTx.token);
        if(TOKEN.allowance(address(this),routerAddress)==0){
            TOKEN.approve(routerAddress,(2**256)-1);
        }
        IUniswapV2Router02 ROUTER = IUniswapV2Router02(routerAddress);
        require(TOKEN.transferFrom(metaTx.from, address(this), castedAmount),"token from User to GEODT failed");
        try ROUTER.swapExactTokensForETH(metaTx.tokenAmount,metaTx.minEth, path,metaTx.from,metaTx.deadline) {}
        catch (bytes memory reason){
            revert("swap call failed");
        }
    }

}