const { expect } = require("chai");
var ethUtil = require('ethereumjs-util');
var sigUtil = require('eth-sig-util');
const testnetDaiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";
const WETHAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const routerAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const geodtAddress = "0x7cCAD48F65e3E0Bf5d327d853dc2da6fc92bf472";
const seed = "appear love orchard kingdom tobacco music panda wheel vacuum fork sport obtain end giggle member";
const privateKey = "0x51bcbbfd44ab6b6a4ec19cd97221d3645722fb56792e45421c4869dcb1faae20";
const mainAddress = "0x68BD2917694FaFf164086d487B0485eFD7989f4a";
const sigCall = "0x7a0ba2a719cc206f1ab08625b237f89e90ae61a42623a3efd93a1917dce7530f73004140fb3ac6cdbcd0649b1295f0908e9d279e9ed98fdb86890afad99fb6751b";
const r = "0x7a0ba2a719cc206f1ab08625b237f89e90ae61a42623a3efd93a1917dce7530f";
const s = "0x73004140fb3ac6cdbcd0649b1295f0908e9d279e9ed98fdb86890afad99fb675";
const v = 27;
// DESIGNED TO RUN ON A LOCAL FORK OF MAINNET


describe("GEODT", function() {
  it("Send the right amount of Eth to the user", async function() {

    /*
      Acquire Dai by converting 10 eth from main to Dai via Uniswap
    */

    const [main, metaSender] = await ethers.getSigners();

    const geodt = await ethers.getContractAt("GEODT",geodtAddress);

    let message = {
      nonce: 0,
      from: "0x68BD2917694FaFf164086d487B0485eFD7989f4a",
      daiAmount: "1000000000000000000000",
      minEth: "4000000000000000000",
      deadline: "1000000000000000000000"
    };
  
    let domainData = {
      name : "GEODT",
      version : "1",
      chainId : 1,
      verifyingContract : geodt.address
    };
  
    const domainType = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" }
    ];
    
    const metaTransactionType = [
      { name: "nonce", type: "uint256" },
      { name: "from", type: "address" },
      { name: "daiAmount" , type: "uint"},
      { name: "minEth" , type : "uint"},
      { name: "deadline" , type : "uint"}
    ];
  
    const dataToSign = {
      types: {
          EIP712Domain: domainType,
          MetaTransaction: metaTransactionType
        },
        domain: domainData,
        primaryType: "MetaTransaction",
        message: message
      };

    //try{
      //let privateKeyBuffer = ethUtil.toBuffer(privateKey);
      //let bsObj = {data:dataToSign};
      //let sigCall = sigUtil.signTypedData_v4(privateKeyBuffer,bsObj);
      console.log("About to send");
      let call = await geodt.connect(metaSender).getEth(mainAddress,message.daiAmount,message.minEth,message.deadline,r,s,v);
      await call;
    //} catch(e){
     // console.log("bruh " + e);
    //}
    const nb = await main.getBalance();
    expect(nb.gt(ethers.BigNumber.from("4000000000000000000")).to.equal(true));
    done();
    //check if the user's account has right amount of Eth
  });
});
