// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

// SushiBar is the coolest bar in town. You come in with some Sushi, and leave with more! The longer you stay, the more Sushi you get.
//
// This contract handles swapping to and from xSushi, SushiSwap's staking token.
contract SushiBar is ERC20("SushiBar", "xSUSHI") {
    using SafeMath for uint256;
    IERC20 public sushi;

    //DUMMY reward pool address
    address REWARD_POOL = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    mapping(address => uint256) public StakeTime;

    // Define the Sushi token contract
    constructor(IERC20 _sushi) {
        sushi = _sushi;
    }

    // Enter the bar. Pay some SUSHIs. Earn some shares.
    // Locks Sushi and mints xSushi
    function enter(uint256 _amount) public {
        // Gets the amount of Sushi locked in the contract
        uint256 totalSushi = sushi.balanceOf(address(this));
        // Gets the amount of xSushi in existence
        uint256 totalShares = totalSupply();
        // If no xSushi exists, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalSushi == 0) {
            _mint(msg.sender, _amount);
        }
        // Calculate and mint the amount of xSushi the Sushi is worth. The ratio will change overtime, as xSushi is burned/minted and Sushi deposited + gained from fees / withdrawn.
        else {
            uint256 what = _amount.mul(totalShares).div(totalSushi);
            _mint(msg.sender, what);
        }

        // Lock the Sushi in the contract
        sushi.transferFrom(msg.sender, address(this), _amount);

        StakeTime[msg.sender] = block.timestamp;
    }

    // Leave the bar. Claim back your SUSHIs.
    // Unlocks the staked + gained Sushi and burns xSushi
    function leave(uint256 _share) public {
        require(
            block.timestamp.sub(StakeTime[msg.sender]) >= 2 * 86400,
            "Cannot unstake before two days"
        );
        // Gets the amount of xSushi in existence
        uint256 totalShares = totalSupply();

        if (allowed(msg.sender, _share)) {
            // Calculates the amount of Sushi the xSushi is worth
            uint256 what = _share.mul(sushi.balanceOf(address(this))).div(
                totalShares
            );
            //Calculate the amount of tax applicable
            uint256 taxAmount = tax(msg.sender, what);

            _burn(msg.sender, _share);
            sushi.transfer(msg.sender, what.sub(taxAmount));

            //Transfer the taxed amount to reward pool
            //Since i wasn't able to figure out which reward pool to transfer the SUSHI to , I am using a dummy address meanwhile
            // 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
            sushi.transfer(REWARD_POOL, taxAmount);
        }
    }

    // checks if user can unstake the requested amount during the time period.
    function allowed(address user, uint256 _share) private view returns (bool) {
        uint256 stakeTime = StakeTime[user];
        uint256 usersTotalShares = this.balanceOf(user);
        uint256 DAY = 86400; //Seconds in day
        uint256 timePassed = block.timestamp.sub(stakeTime);

        if (2 * DAY <= timePassed && timePassed < 4 * DAY) {
            require(
                usersTotalShares.mul(25).div(100) >= _share,
                "Cannot unstake more than 25% before 4 days"
            );
            return true;
        } else if (4 * DAY <= timePassed && timePassed < 6 * DAY) {
            require(
                usersTotalShares.mul(50).div(100) >= _share,
                "Cannot unstake more than 50% before 6 days"
            );
            return true;
        } else if (6 * DAY <= timePassed && timePassed < 8 * DAY) {
            require(
                usersTotalShares.mul(75).div(100) >= _share,
                "Cannot unstake more than 75% before 8 days"
            );
            return true;
        } else {
            return true;
        }
    }

    //Returns the amount of tax to be applied on the SUSHI tokens being unstaked.
    function tax(address user, uint256 what) private view returns (uint256) {
        uint256 stakeTime = StakeTime[user];
        uint256 DAY = 86400; //Seconds in day
        uint256 timePassed = block.timestamp.sub(stakeTime);

        if (2 * DAY <= timePassed && timePassed < 4 * DAY) {
            return what.mul(75).div(100); //75% tax for unstaking before 4 days
        } else if (4 * DAY <= timePassed && timePassed < 6 * DAY) {
            return what.mul(50).div(100); //50% tax for unstaking before 6 days
        } else if (6 * DAY <= timePassed && timePassed < 8 * DAY) {
            return what.mul(25).div(100); //25% tax for unstaking before 8 days
        } else {
            return 0; //0% tax for unstaking after 8 days
        }
    }
}
