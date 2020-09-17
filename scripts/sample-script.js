// We require the Buidler Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `buidler run <script>` you'll find the Buidler
// Runtime Environment's members available in the global scope.
const bre = require("@nomiclabs/buidler");
var ethUtil = require('ethereumjs-util');
var sigUtil = require('eth-sig-util');
const testnetDaiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";
const WETHAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const privateKey = "0x51bcbbfd44ab6b6a4ec19cd97221d3645722fb56792e45421c4869dcb1faae20";
const mainAddress = "0x68BD2917694FaFf164086d487B0485eFD7989f4a";
const routerAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

async function main() {
  // Buidler always runs the compile task when running scripts through it. 
  // If this runs in a standalone fashion you may want to call compile manually 
  // to make sure everything is compiled
  // await bre.run('compile');

  // We get the contract to deploy
  const [main, metaSender] = await ethers.getSigners();
  const GEODT = await ethers.getContractFactory("GEODT");
  const geodt = await GEODT.deploy(testnetDaiAddress,WETHAddress);
  await geodt.deployed();
  console.log("geodt deployed to ",geodt.address);

  let message = {
    nonce: 0,
    from: mainAddress,
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

  let privateKeyBuffer = ethUtil.toBuffer(privateKey);
  let bsObj = {data:dataToSign};
  let sigCall = sigUtil.signTypedData_v4(privateKeyBuffer,bsObj);
  const signature = sigCall.substring(2);
  const r = "0x" + signature.substring(0, 64);
      const s = "0x" + signature.substring(64, 128);
      const v = parseInt(signature.substring(128, 130), 16);
  console.log("returned signature ",sigCall);
  console.log("r :",r);
  console.log("s :",s);
  console.log("v :",v);
  const daiContract = await ethers.getContractAt("TestnetDAI",testnetDaiAddress);

  const router = await ethers.getContractAt("IRouter02",routerAddress);


  await router.swapExactETHForTokens("1000000000000000000000",[WETHAddress,testnetDaiAddress],main.getAddress(),
  "1000000000000000000000",{value:   "5000000000000000000"});

  const daiBalance = await daiContract.balanceOf(mainAddress);
  await daiContract.approve(geodt.address,"1000000000000000000000");

  console.log("dai balance : ",await daiBalance);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
