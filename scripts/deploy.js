// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  
  //Deploy the SUSHI token
  const SushiToken = await hre.ethers.getContractFactory("SushiToken");
  const sushiToken = await SushiToken.deploy();

  await sushiToken.deployed();
  console.log(
    `Deployed Sushi Token at : ${sushiToken.address}`
  );

  //Deploy SushiBar passing Sushi Token address
  const SushiBar = await hre.ethers.getContractFactory("SushiBar");
  const sushiBar = await SushiBar.deploy(sushiToken.address);

  await sushiBar.deployed();

  console.log(
    `Deployed SushiBar contract at : ${sushiBar.address}`
  );

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
