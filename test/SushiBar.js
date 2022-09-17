const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("SushiBar", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractsFixture() {
    const REWARD_POOL = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; //dummy account

    //User starts with 1,00,000 SUSHI tokens
    const startBalance = 100_000;
    const shares = startBalance;

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();
    //owner : 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

    //Deploy the SUSHI token
    const SushiToken = await hre.ethers.getContractFactory("SushiToken");
    const sushiToken = await SushiToken.deploy();

    await sushiToken.deployed();

    //Mint some tokens to owner for subsequent testing
    await sushiToken.mint(owner.address, startBalance);

    //Deploy SushiBar passing Sushi Token address
    const SushiBar = await hre.ethers.getContractFactory("SushiBar");
    const sushiBar = await SushiBar.deploy(sushiToken.address);

    await sushiBar.deployed();

    return {
      sushiBar,
      sushiToken,
      owner,
      otherAccount,
      startBalance,
      REWARD_POOL,
      shares,
    };
  }

  describe("Deployment", function () {
    it("Should mint the tokens to user", async function () {
      const { sushiToken, owner, startBalance } = await loadFixture(
        deployContractsFixture
      );

      expect(await sushiToken.balanceOf(owner.address)).to.equal(startBalance);
    });

    it("Should set the sushi token address in contract", async function () {
      const { sushiBar, sushiToken } = await loadFixture(
        deployContractsFixture
      );

      expect(await sushiBar.sushi()).to.equal(sushiToken.address);
    });
  });

  describe("Staking and Un-Staking", function () {
    it("Should allow staking", async function () {
      const { sushiBar, sushiToken, owner, startBalance } = await loadFixture(
        deployContractsFixture
      );

      //Approve sushiBar to transfer SUSHI tokens
      await sushiToken.approve(sushiBar.address, startBalance);

      //Stake SUSHI
      await sushiBar.enter(startBalance);

      //Post stake , the SUSHI amount should be transfered
      expect(await sushiToken.balanceOf(owner.address)).to.equal(0);
    });

    it("Should not allow unstaking before 2 days", async function () {
      const { sushiBar, sushiToken, startBalance } = await loadFixture(
        deployContractsFixture
      );

      // Stake SUSHI
      await sushiToken.approve(sushiBar.address, startBalance);
      await sushiBar.enter(startBalance);

      await expect(sushiBar.leave(startBalance)).to.be.revertedWith(
        "Cannot unstake before two days"
      );
    });
    it("Should allow 25% unstaking after 2 days", async function () {
      const { sushiBar, sushiToken, owner, startBalance, shares } =
        await loadFixture(deployContractsFixture);

      // Stake SUSHI
      await sushiToken.approve(sushiBar.address, startBalance);
      await sushiBar.enter(startBalance);

      const shares_25 = shares * (25 / 100);
      await time.increase(time.duration.days(2));

      //Post untake 25% share amount should be burnt from SushiBar
      await expect(sushiBar.leave(shares_25)).to.changeTokenBalance(
        sushiBar,
        owner,
        -shares_25
      );
    });
    it("Should not allow unstaking more than 25% before 4 days", async function () {
      const { sushiBar, sushiToken, startBalance, shares } = await loadFixture(
        deployContractsFixture
      );

      // Stake SUSHI
      await sushiToken.approve(sushiBar.address, startBalance);
      await sushiBar.enter(startBalance);

      const shares_25 = shares * (25 / 100);
      await time.increase(time.duration.days(2));

      await expect(sushiBar.leave(shares_25 + 1)).to.be.revertedWith(
        "Cannot unstake more than 25% before 4 days"
      );
    });
    it("Should allow 75% unstaking after 6 days", async function () {
      const { sushiBar, sushiToken, owner, startBalance, shares } =
        await loadFixture(deployContractsFixture);

      // Stake SUSHI
      await sushiToken.approve(sushiBar.address, startBalance);
      await sushiBar.enter(startBalance);

      const shares_75 = shares * (75 / 100);
      await time.increase(time.duration.days(6));

      //post unstake the 75% share should be burnt from SushiBar
      await expect(sushiBar.leave(shares_75)).to.changeTokenBalance(
        sushiBar,
        owner,
        -shares_75
      );
    });
    it("Should not allow unstaking more than 75% before 8 days", async function () {
      const { sushiBar, sushiToken, startBalance, shares } = await loadFixture(
        deployContractsFixture
      );

      // Stake SUSHI
      await sushiToken.approve(sushiBar.address, startBalance);
      await sushiBar.enter(startBalance);

      const shares_75 = shares * (75 / 100);
      await time.increase(time.duration.days(6));

      await expect(sushiBar.leave(shares_75 + 1)).to.be.revertedWith(
        "Cannot unstake more than 75% before 8 days"
      );
    });
    it("Should allow 100% unstaking after 8 days", async function () {
      const { sushiBar, sushiToken, owner, startBalance, shares } =
        await loadFixture(deployContractsFixture);

      // Stake SUSHI
      await sushiToken.approve(sushiBar.address, startBalance);
      await sushiBar.enter(startBalance);

      await time.increase(time.duration.days(8));

      //Post unstake , 100% share amount should be burnt fromm SushiBar
      await expect(sushiBar.leave(shares)).to.changeTokenBalance(
        sushiBar,
        owner,
        -shares
      );
    });
  });

  describe("Taxation", function () {
    it("Should apply 75% tax when unstaked before 4 days", async function () {
      const { sushiBar, sushiToken, startBalance, shares, REWARD_POOL } =
        await loadFixture(deployContractsFixture);

      // Stake SUSHI
      await sushiToken.approve(sushiBar.address, startBalance);
      await sushiBar.enter(startBalance);

      //user's shares = 1_00_000
      //25% = 25_000
      const shares_25 = shares * (25 / 100);
      //tax amount  = 25_000's 75% = 18_750
      const taxAmount = shares_25 * (75 / 100);
      await time.increase(time.duration.days(2));

      await expect(sushiBar.leave(shares_25)).to.changeTokenBalances(
        sushiToken,
        [sushiBar, REWARD_POOL],
        [-shares_25, taxAmount]
      );
    });
    it("Should apply no tax when unstaked after 8 days", async function () {
      const { sushiBar, sushiToken, startBalance, shares, REWARD_POOL } =
        await loadFixture(deployContractsFixture);

      // Stake SUSHI
      await sushiToken.approve(sushiBar.address, startBalance);
      await sushiBar.enter(startBalance);

      await time.increase(time.duration.days(8));

      await expect(sushiBar.leave(shares)).to.changeTokenBalances(
        sushiToken,
        [sushiBar, REWARD_POOL],
        [-shares, 0]
      );
    });
  });
});
