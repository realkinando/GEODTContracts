const { expect } = require("chai");

describe("GEODT", function() {

  // Contract Objects

  let uniswapV2Factory;

  let testRouter;

  let weth9;

  let geodt;

  let testnetDAI;

  // Signers

  let accounts;

  let domainData;

  const domainType = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" }
  ];
  
  const metaTransactionType = [
    { name: "nonce", type: "uint256" },
    { name: "from", type: "address" },
    { name: "feeReceiver", type: "address" },
    { name: "token", type: "address" },
    { name: "tokenAmount" , type: "uint"},
    { name: "minEth" , type : "uint"},
    { name: "deadline" , type : "uint"},
    { name: "fee", type : "uint256"}
  ];

  before(async function() {

    //get signers
    accounts = await ethers.getSigners();

    //deploy WETH9
    const WETH9 = await ethers.getContractFactory("WETH9");
    weth9 = await WETH9.deploy();
    await weth9.deployed();
    console.log("WETH Deployed")

    //deploy Factory
    const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
    uniswapV2Factory = await UniswapV2Factory.deploy("0xc0a4272bb5df52134178df25d77561cfb17ce407");
    await uniswapV2Factory.deployed();
    console.log("Factory Deployed");

    //deploy router
    const TestRouter = await ethers.getContractFactory("TestRouter");
    testRouter = await TestRouter.deploy(uniswapV2Factory.address,weth9.address);
    await testRouter.deployed();
    console.log("Router Deployed");

    //deploy testnet Dai
    const TestnetDAI = await ethers.getContractFactory("TestnetDAI");
    testnetDAI = await TestnetDAI.deploy();
    await testnetDAI.deployed();
    console.log("Testnet Dai Deployed");

    //deploy geodt
    const GEODT = await ethers.getContractFactory("GEODT");
    geodt = await GEODT.deploy(weth9.address,testRouter.address);
    await geodt.deployed();
    console.log("GEODT deployed");

    domainData = {
      name : "GEODT",
      version : "1",
      chainId : 42,
      verifyingContract : geodt.address
    };

    //add liquidity to pair (400 Dai : 1 Eth) x 1000
    //we do this manually cos of a weird Uniswap Router bug that only exists in the local testing environment
    await uniswapV2Factory.createPair(weth9.address,testnetDAI.address);
    const pairAddress = await uniswapV2Factory.getPair(weth9.address,testnetDAI.address);
    console.log("pair created");
    const pairContract = await ethers.getContractAt("UniswapV2Pair",pairAddress);
    await testnetDAI.mint(await pairAddress,ethers.utils.parseEther("400000"));
    await weth9.deposit({value:ethers.utils.parseEther("1000")});
    await weth9.transfer(pairAddress,ethers.utils.parseEther("1000"));
    await pairContract.mint(await accounts[0].getAddress());
    /**await uniswapV2Router02.addLiquidityETH(testnetDAI.address,ethers.utils.parseEther("400000"),
                                      ethers.utils.parseEther("400000"),ethers.utils.parseEther("1000"),
                                      await accounts[0].getAddress(),Math.floor(Date.now()/1000)+1000);
    console.log("Liquidity Added");**/

    //approve geodt to spend accounts[1] dai
    await testnetDAI.connect(accounts[1]).approve(geodt.address,ethers.utils.parseEther("10000000000000000000000000"));
    console.log("Account[0] approved geodt");

  });

  //1sends correct amount of eth to user
  //1fee is sent to correct address
  //2nonce is updated
  //3correct amount of ERC20 is transferred
  //4Tx is rejected when Fee is not sufficient to cover gas cost
  //5Gas is lower for subsequent Txs of same pair
  it("Send the right amount of Eth to the user", async function() {

    //give accounts[1] 1000 Dai
    await testnetDAI.mint(await accounts[1].getAddress(),ethers.utils.parseEther("400"));
    console.log("Account[1] Debited");

    let message = {
      nonce: 0,
      from: await accounts[1].getAddress(),
      feeReceiver: await accounts[0].getAddress(),
      token: testnetDAI.address,
      tokenAmount: "400000000000000000000",
      minEth:      "900000000000000000",
      deadline: "1000000000000000000000",
      fee:         "100000000000000000"
    };
  
    const dataToSign = {
      types: {
          EIP712Domain: domainType,
          MetaTransaction: metaTransactionType
        },
        domain: domainData,
        primaryType: "MetaTransaction",
        message: message
      };
    //get account[0] balance
    //get account[1] balance
    //get gasEstimate for account[0]
    
    //calculate post tx balance for account[0]

    //try{
      //let privateKeyBuffer = ethUtil.toBuffer(privateKey);
      //let bsObj = {data:dataToSign};
      //let sigCall = sigUtil.signTypedData_v4(privateKeyBuffer,bsObj);
      const result = await ethers.provider.send("eth_signTypedData",[message.from,dataToSign]);
      console.log("success",result);
      const signature = result.substring(2);
      const r = "0x" + signature.substring(0, 64);
      const s = "0x" + signature.substring(64, 128);
      const v = parseInt(signature.substring(128, 130), 16);
      console.log("About to send");
      let call = await geodt.getEth(message,r,s,v);
      await call;
    //} catch(e){
     // console.log("bruh " + e);
    //}
    const nb = await accounts[1].getBalance();
    console.log(nb);
    expect((nb.gt(ethers.BigNumber.from("900000000000000000"))).to.equal(true));
    done();
    //check if the user's account has right amount of Eth
  });
});
