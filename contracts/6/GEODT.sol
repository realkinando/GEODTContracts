pragma solidity =0.6.6;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GEODT is Ownable{

    using SafeMath for uint;

    address public routerAddress;

    address public WETH;

    mapping(bytes4=>bool) public approvedFunctions; // only owner

    mapping(bytes4=>bool) public bannedFunctions; // only populate in constructor, first layer of security
    
    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
        address verifyingContract;
    }

    struct MetaTransaction {
		uint256 nonce;
		address from;
        address feeReceiver;
        address token;
        uint tokenAmount;
        uint minEth;
        uint deadline;
        uint256 fee;
    }

    mapping(address => uint256) public nonces;
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
    keccak256(bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));

    bytes32 internal constant META_TRANSACTION_TYPEHASH =
    keccak256(bytes("MetaTransaction(uint256 nonce,address from,address feeReceiver,address token,uint tokenAmount,uint minEth,uint deadline,uint256 fee)"));
    bytes32 internal DOMAIN_SEPARATOR = keccak256(abi.encode(
        EIP712_DOMAIN_TYPEHASH,
		keccak256(bytes("GEODT")),
		keccak256(bytes("1")),
		42, // Kovan, change when deploying
		address(this)
    ));

    constructor(address _WETH, address _router) public{
        WETH = _WETH;
        routerAddress = _router;
        //ban transferFrom
        bannedFunctions[bytes4(keccak256("transferFrom(address,address,amount)"))] = true;
        //approve Dai Permit
        approvedFunctions[bytes4(keccak256("permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)"))] = true;
    }

    receive() external payable {}

    function approveFunction(bytes4 funct) external onlyOwner {
        require(bannedFunctions[funct]==false,"Not allowed");
        approvedFunctions[funct] = true;
    } 

    function getEth(MetaTransaction memory metaTx, bytes32 r, bytes32 s, uint8 v) public {
        require(tx.gasprice.mul(gasleft())<metaTx.fee,"Gas Cost Exceeds Fee");
        bytes32 digest = keccak256(
            abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(abi.encode(META_TRANSACTION_TYPEHASH, metaTx.nonce, metaTx.from, metaTx.feeReceiver,metaTx.token,
                    metaTx.tokenAmount, metaTx.minEth,metaTx.deadline,metaTx.fee))
                )
            );
        require(metaTx.nonce == nonces[metaTx.from],"nonce invalid");
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
        try ROUTER.swapExactTokensForETH(metaTx.tokenAmount,metaTx.minEth, path,address(this),metaTx.deadline) {}
        catch (bytes memory reason){
            revert(string(abi.encodePacked("swap call failed",reason)));
        }
        require(metaTx.fee<address(this).balance,"fee exceeds balance");
        payable(metaTx.feeReceiver).transfer(metaTx.fee);
        payable(metaTx.from).transfer(address(this).balance);
    }

    function getEthWithPermit(MetaTransaction calldata metaTx, bytes32 r, bytes32 s, uint8 v, bytes calldata permitData) external{
        require(tx.gasprice.mul(gasleft())<metaTx.fee,"Gas Cost Exceeds Fee");
        bytes4 sig =
            permitData[0] |
            (bytes4(permitData[1]) >> 8) |
            (bytes4(permitData[2]) >> 16) |
            (bytes4(permitData[3]) >> 24);
        require(approvedFunctions[sig],"Function not approved");
        metaTx.token.call(permitData); //get Eth will throw if this fails
        getEth(metaTx,r,s,v);
    }

}