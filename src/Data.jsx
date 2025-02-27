import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./Data.css";
import Model from './Model'

// 1) Import MUI components
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";




function App() {
    // use this state if we want address search feature
    // const [userInput, setUserInput] = useState("");
    // const [userBalances, setUserBalances] = useState(null);
    const [ogpBalances, setOgpBalances] = useState(null);
    const [communityPoolBalances, setCommunityPoolBalances] = useState(null);
    const [topBlockAuctionBalances, setTopBlockAuctionBalances] = useState(null);
    const [clPositions, setClPositions] = useState([]);
    const [prices, setPrices] = useState(null);
    const [assetList, setAssetList] = useState(null);
    // const [loadingAssets, setLoadingAssets] = useState(true);
    const [error, setError] = useState(null);
    const [totalWorth, setTotalWorth] = useState(0);

    const OGP_ADDRESS = "osmo1vpmwzt4mt6cfnnwtrpv79tn09yx2r3s56chpln";
    const COMMUNITY_POOL_ADDRESS = "osmo1jv65s3grqf6v6jl3dp4t6c9t9rk99cd80yhvld";
    const TOP_OF_BLOCK_AUCTION_ADDRESS = "osmo1j4yzhgjm00ch3h0p9kel7g8sp6g045qfnc9kmc";
    const TOP_OF_BLOCK_AUCTION_DENOM =
        "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4";

    const getAssetInfo = useCallback((denom) => {
        const asset = assetList?.find((asset) => asset.coinMinimalDenom === denom);
        if (!asset) return null;
        return { name: asset.name, decimals: asset.decimals };
    }, [assetList]); // <-- Added dependency array



    const calculateWorth = useCallback((balances, clPositions) => {
        let totalWorth = 0;

        // Calculate worth for balances
        balances.forEach((balance) => {
            const assetInfo = getAssetInfo(balance.denom);
            if (assetInfo) {
                const priceObject = prices?.[balance.denom];
                const price = priceObject ? parseFloat(Object.values(priceObject)[0]) : 0;
                const rawAmount = parseFloat(balance.amount);
                const adjustedAmount = rawAmount / Math.pow(10, assetInfo.decimals);
                totalWorth += adjustedAmount * price;
            }
        });

        // Calculate worth for CL positions
        clPositions.forEach((position) => {
            const asset0Info = getAssetInfo(position.asset0.denom);
            const asset1Info = getAssetInfo(position.asset1.denom);
            if (asset0Info && asset1Info) {
                const price0 = prices?.[position.asset0.denom]
                    ? parseFloat(Object.values(prices[position.asset0.denom])[0])
                    : 0;
                const price1 = prices?.[position.asset1.denom]
                    ? parseFloat(Object.values(prices[position.asset1.denom])[0])
                    : 0;
                const amount0 =
                    parseFloat(position.asset0.amount) / Math.pow(10, asset0Info.decimals);
                const amount1 =
                    parseFloat(position.asset1.amount) / Math.pow(10, asset1Info.decimals);
                totalWorth += amount0 * price0 + amount1 * price1;
            }
        });

        return totalWorth;
    }, [prices, getAssetInfo]); // Dependencies for calculateWorth


    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch Asset List
                const assetListResponse = await axios.get(
                    "https://raw.githubusercontent.com/osmosis-labs/assetlists/main/osmosis-1/generated/frontend/assetlist.json"
                );
                setAssetList(assetListResponse.data.assets);

                // Fetch OGP Balances
                const ogpBalancesResponse = await axios.get(
                    `https://lcd.osmosis.zone/cosmos/bank/v1beta1/balances/${OGP_ADDRESS}`
                );
                setOgpBalances(ogpBalancesResponse.data.balances);

                // Fetch Community Pool Balances
                const communityPoolBalancesResponse = await axios.get(
                    `https://lcd.osmosis.zone/cosmos/bank/v1beta1/balances/${COMMUNITY_POOL_ADDRESS}`
                );
                setCommunityPoolBalances(communityPoolBalancesResponse.data.balances);

                // Fetch CL Positions
                const clPositionsResponse = await axios.get(
                    `https://lcd.osmosis.zone/osmosis/concentratedliquidity/v1beta1/positions/${COMMUNITY_POOL_ADDRESS}`
                );
                setClPositions(clPositionsResponse.data.positions);

                // Fetch Top of Block Auction Balances
                const topBlockAuctionBalancesResponse = await axios.get(
                    `https://lcd.osmosis.zone/cosmos/bank/v1beta1/balances/${TOP_OF_BLOCK_AUCTION_ADDRESS}`
                );
                const filteredTopBlockBalances =
                    topBlockAuctionBalancesResponse.data.balances.filter(
                        (b) => b.denom === TOP_OF_BLOCK_AUCTION_DENOM
                    );
                setTopBlockAuctionBalances(filteredTopBlockBalances);

                // Fetch prices for OGP balances, CL assets, and top of block auction denom
                const allDenoms = [
                    ...new Set([
                        ...ogpBalancesResponse.data.balances.map((b) => b.denom),
                        ...clPositionsResponse.data.positions.flatMap((p) => [
                            p.asset0.denom,
                            p.asset1.denom,
                        ]),
                        ...filteredTopBlockBalances.map((b) => b.denom),
                    ]),
                ];
                const encodedDenoms = allDenoms
                    .map((denom) => encodeURIComponent(denom))
                    .join("%2C");
                const pricesResponse = await axios.get(
                    `https://sqs.osmosis.zone/tokens/prices?base=${encodedDenoms}&humanDenoms=false`
                );
                setPrices(pricesResponse.data);
            } catch (err) {
                console.error("Failed to fetch initial data:", err);
                setError("Failed to load data. Please try again later.");
            }
        };

        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!prices || !assetList) {
            return;
        }

        let ogpTotal = 0;
        if (ogpBalances) {
            ogpTotal = calculateWorth(ogpBalances, []);
        }

        let communityPoolTotal = 0;
        if (communityPoolBalances) {
            communityPoolTotal = calculateWorth(communityPoolBalances, []);
        }

        let topBlockAuctionTotal = 0;
        if (topBlockAuctionBalances) {
            topBlockAuctionTotal = calculateWorth(topBlockAuctionBalances, []);
        }

        let clPositionsTotal = 0;
        if (clPositions && clPositions.length > 0) {
            clPositionsTotal = calculateWorth([], clPositions);
        }

        const grandTotal =
            ogpTotal +
            communityPoolTotal +
            topBlockAuctionTotal +
            clPositionsTotal;

        setTotalWorth(grandTotal);
    }, [
        calculateWorth, // Now included in dependencies
        ogpBalances,
        communityPoolBalances,
        topBlockAuctionBalances,
        clPositions,
        assetList,
        prices,
    ]);

    // uncomment if we want address search
    // const handleSubmit = async (e) => {
    //     e.preventDefault();
    //     setError(null);
    //     setUserBalances(null);

    //     try {
    //         const userBalancesResponse = await axios.get(
    //             `https://lcd.osmosis.zone/cosmos/bank/v1beta1/balances/${userInput}`
    //         );
    //         setUserBalances(userBalancesResponse.data.balances);

    //         const userDenoms = userBalancesResponse.data.balances
    //             .map((b) => encodeURIComponent(b.denom))
    //             .join("%2C");
    //         const userPricesResponse = await axios.get(
    //             `https://sqs.osmosis.zone/tokens/prices?base=${userDenoms}&humanDenoms=false`
    //         );
    //         // Merge user prices into the existing prices
    //         setPrices((prevPrices) => ({ ...prevPrices, ...userPricesResponse.data }));
    //     } catch (err) {
    //         setError("Failed to fetch user balances.");
    //     }
    // };

    const renderTable = (title, balances) => {
        if (!balances || !prices) return null;

        // Filter balances worth less than $100
        const filteredBalances = balances.filter((balance) => {
            const assetInfo = getAssetInfo(balance.denom);
            if (!assetInfo) return false;

            const priceObject = prices[balance.denom];
            const price = priceObject ? parseFloat(Object.values(priceObject)[0]) : 0;
            const rawAmount = parseFloat(balance.amount);
            const adjustedAmount = rawAmount / Math.pow(10, assetInfo.decimals);

            const totalWorth = adjustedAmount * price;
            return totalWorth >= 100; // Keep balances worth $100 or more
        });

        // Calculate total worth and (if applicable) non-OSMO worth
        let totalWorth = 0;
        let nonOsmoWorth = 0;

        filteredBalances.forEach((balance) => {
            const assetInfo = getAssetInfo(balance.denom);
            if (!assetInfo) return;

            const priceObject = prices[balance.denom];
            const price = priceObject ? parseFloat(Object.values(priceObject)[0]) : 0;
            const rawAmount = parseFloat(balance.amount);
            const adjustedAmount = rawAmount / Math.pow(10, assetInfo.decimals);

            const worth = adjustedAmount * price;
            totalWorth += worth;

            if (title === "OGP Multisig Balances" && balance.denom !== "uosmo") {
                nonOsmoWorth += worth;
            }
        });

        // Sort balances by worth (USD) in descending order
        const sortedBalances = filteredBalances.sort((a, b) => {
            const assetInfoA = getAssetInfo(a.denom);
            const assetInfoB = getAssetInfo(b.denom);

            if (!assetInfoA || !assetInfoB) return 0;

            const priceA = prices[a.denom]
                ? parseFloat(Object.values(prices[a.denom])[0])
                : 0;
            const priceB = prices[b.denom]
                ? parseFloat(Object.values(prices[b.denom])[0])
                : 0;

            const adjustedAmountA =
                parseFloat(a.amount) / Math.pow(10, assetInfoA.decimals);
            const adjustedAmountB =
                parseFloat(b.amount) / Math.pow(10, assetInfoB.decimals);

            const totalWorthA = adjustedAmountA * priceA;
            const totalWorthB = adjustedAmountB * priceB;

            return totalWorthB - totalWorthA; // Descending order
        });

        return (
            <div className="top-level-table" >
                <h2>
                    <div className="table-title">
                        {title}{" "}
                    </div>

                    <span>
                        $
                        {totalWorth.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </span>
                </h2>
                {title === "OGP Multisig Balances" && nonOsmoWorth > 0 && (
                    <p className="non-osmo-text">
                        (Non-OSMO Assets Worth: $
                        {nonOsmoWorth.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })})
                    </p>
                )}
                {/* MUI Table */}
                <TableContainer
                    component={Paper}
                    sx={{
                        mx: { xs: 2, md: 0 }, // or just `mx: 2` for all screen sizes
                        // marginTop: 2,
                        maxWidth: 500,  // or any width you prefer

                        // marginRight: 2,
                        backgroundColor: "transparent",
                        color: "white",
                        overflowX: "auto",
                    }}
                >
                    <Table
                        sx={{
                            minWidth: 350,
                            color: "white",
                        }}
                        aria-label={`${title} table`}>
                        <TableHead>
                            <TableRow sx={{ fontFamily: 'Roboto Mono' }}>
                                <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>Denom</TableCell>
                                <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>Amount</TableCell>
                                <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>Worth (USD)</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedBalances.map((balance, index) => {
                                const assetInfo = getAssetInfo(balance.denom);
                                if (!assetInfo) return null;

                                const priceObject = prices[balance.denom];
                                const price = priceObject
                                    ? parseFloat(Object.values(priceObject)[0])
                                    : 0;
                                const rawAmount = parseFloat(balance.amount);
                                const adjustedAmount =
                                    rawAmount / Math.pow(10, assetInfo.decimals);

                                const balanceWorth = adjustedAmount * price;

                                return (
                                    <TableRow key={index}>
                                        <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>{assetInfo.name}</TableCell>
                                        <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>{adjustedAmount.toLocaleString()}</TableCell>
                                        <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>
                                            $
                                            {balanceWorth.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </div>
        );
    };

    const renderClPositionsTable = () => {
        if (!clPositions || !prices) return null;

        const filteredPositions = clPositions.filter((position) => {
            const asset0Info = getAssetInfo(position.asset0.denom);
            const asset1Info = getAssetInfo(position.asset1.denom);

            if (!asset0Info || !asset1Info) return false;

            const price0 = prices?.[position.asset0.denom]
                ? parseFloat(Object.values(prices[position.asset0.denom])[0])
                : 0;
            const price1 = prices?.[position.asset1.denom]
                ? parseFloat(Object.values(prices[position.asset1.denom])[0])
                : 0;

            const amount0 =
                parseFloat(position.asset0.amount) / Math.pow(10, asset0Info.decimals);
            const amount1 =
                parseFloat(position.asset1.amount) / Math.pow(10, asset1Info.decimals);

            const totalWorth = amount0 * price0 + amount1 * price1;
            return totalWorth >= 100; // Keep positions worth $100 or more
        });

        const totalWorth = filteredPositions.reduce((sum, position) => {
            const asset0Info = getAssetInfo(position.asset0.denom);
            const asset1Info = getAssetInfo(position.asset1.denom);

            if (!asset0Info || !asset1Info) return sum;

            const price0 = prices?.[position.asset0.denom]
                ? parseFloat(Object.values(prices[position.asset0.denom])[0])
                : 0;
            const price1 = prices?.[position.asset1.denom]
                ? parseFloat(Object.values(prices[position.asset1.denom])[0])
                : 0;

            const amount0 =
                parseFloat(position.asset0.amount) / Math.pow(10, asset0Info.decimals);
            const amount1 =
                parseFloat(position.asset1.amount) / Math.pow(10, asset1Info.decimals);

            return sum + amount0 * price0 + amount1 * price1;
        }, 0);

        return (
            <div className="top-level-table">
                <h2>
                    <div className="table-title">
                        Community Pool CL Positions{" "}
                    </div>
                    <span>
                        $
                        {totalWorth.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </span>
                </h2>

                {/* MUI Table */}
                <TableContainer component={Paper} sx={{ marginTop: 2, background: "transparent" }}>
                    <Table sx={{ minWidth: 650 }} aria-label="CL Positions table">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>Pool ID</TableCell>
                                <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>Asset 0</TableCell>
                                <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>Asset 1</TableCell>
                                <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>Total Worth (USD)</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredPositions.map((position, index) => {
                                const asset0Info = getAssetInfo(position.asset0.denom);
                                const asset1Info = getAssetInfo(position.asset1.denom);

                                const price0 = prices?.[position.asset0.denom]
                                    ? parseFloat(Object.values(prices[position.asset0.denom])[0])
                                    : 0;
                                const price1 = prices?.[position.asset1.denom]
                                    ? parseFloat(Object.values(prices[position.asset1.denom])[0])
                                    : 0;

                                const amount0 =
                                    parseFloat(position.asset0.amount) /
                                    Math.pow(10, asset0Info.decimals);
                                const amount1 =
                                    parseFloat(position.asset1.amount) /
                                    Math.pow(10, asset1Info.decimals);

                                const positionWorth = amount0 * price0 + amount1 * price1;

                                return (
                                    <TableRow key={index}>
                                        <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>{position.position.pool_id}</TableCell>
                                        <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>
                                            {asset0Info.name}: {amount0.toLocaleString()}
                                        </TableCell>
                                        <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>
                                            {asset1Info.name}: {amount1.toLocaleString()}
                                        </TableCell>
                                        <TableCell sx={{ color: "#f5f5f5", fontFamily: 'Roboto Mono' }}>
                                            $
                                            {positionWorth.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </div>
        );
    };

    return (
        <div className="app-container">
            <div className="app-content">
                <div className="title-container">
                    <Model />
                    <h1 className="title">Osmosis Community Pool Balance</h1>
                </div>
                <div className="round-border">
                    <div className="total-worth-line">
                        $
                        {totalWorth.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </div>
                    <div className="total-worth">total worth in community pool</div>
                </div>


                {ogpBalances && renderTable("OGP Multisig Balance", ogpBalances)}
                {topBlockAuctionBalances &&
                    renderTable("Top of Block Auction Balance", topBlockAuctionBalances)}
                {communityPoolBalances &&
                    renderTable("Community Pool Balance", communityPoolBalances)}

                {clPositions && renderClPositionsTable()}


                {/* {userBalances && renderTable("User Balance", userBalances)} */}
                {/* 
        <form onSubmit={handleSubmit}>
          <label>
            Enter User Address:
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Enter address"
              required
            />
          </label>
          <button type="submit">Check Balance & Worth</button>
        </form> */}

                {error && <p className="error-text">Error: {error}</p>}
            </div>
        </div>
    );
}

export default App;
