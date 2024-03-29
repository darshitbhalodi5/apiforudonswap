const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;
require("dotenv").config();

app.use(express.json());
app.use(cors());

// Helper function to authenticate token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Construct the path to Tokens.json file
const tokensFilePath = path.join(__dirname, "Tokens.json");

// Helper function to fetch token details from the link
const fetchTokens = async () => {
  try {
    const allTokens = [];
    let nextPageParams = null;

    do {
      const url = nextPageParams
        ? `https://sepolia.explorer.mode.network/api/v2/tokens?type=ERC-20&${new URLSearchParams(
            nextPageParams
          ).toString()}`
        : "https://sepolia.explorer.mode.network/api/v2/tokens?type=ERC-20";

      const response = await axios.get(url);
      const responseData = response.data;

      // Add the tokens from the current page to the list
      allTokens.push(...responseData.items);

      //   console.log(i);
      //   console.log("responseData", responseData);

      // Check if there are more pages available
      nextPageParams = responseData.next_page_params;
    } while (nextPageParams);

    return { items: allTokens };
  } catch (error) {
    console.error(
      "Error fetching tokens:",
      error.response ? error.response.data : error.message
    );
    return [];
  }
};

// Endpoint to fetch tokens from Tokens.json file ==> First Requirement
app.get("/tokens", (req, res) => {
  try {
    // Read Tokens.json file
    const tokensFile = fs.readFileSync(tokensFilePath);
    const tokensData = JSON.parse(tokensFile);

    // Send the tokens data as the response
    res.json(tokensData);
  } catch (error) {
    console.error("Error reading Tokens.json file:", error.message);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

// Endpoint to update the logoURI of a token ==> Third Requirement
app.post("/addlogoURI", (req, res) => {
  try {
    const { address, url } = req.body;

    if (!address || !url) {
      return res
        .status(400)
        .json({ error: "Missing address or URL in request body" });
    }

    fs.readFile(tokensFilePath, "utf8", (err, data) => {
      if (err) {
        console.error("Error reading token list:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      let tokenList = JSON.parse(data);
      const tokenIndex = tokenList.tokens.findIndex(
        (token) => token.address === address
      );
      if (tokenIndex === -1) {
        return res.status(404).json({ error: "Token not found" });
      }

      tokenList.tokens[tokenIndex].logoURI = url;
      fs.writeFile(
        tokensFilePath,
        JSON.stringify(tokenList, null, 2),
        (err) => {
          if (err) {
            console.error("Error writing token list:", err);
            return res.status(500).json({ error: "Internal server error" });
          }
          res.json({ message: "LogoURI updated successfully" });
        }
      );
    });
  } catch (error) {
    console.error("Error updating logoURI:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// generate a new token with id and name
app.post("/login", (req, res) => {
  // Assuming you have a user object with id and username
  const user = { id: 1, username: "Lampros" };

  // Sign the token using your secret key
  jwt.sign({ user }, process.env.SECRET_KEY, (err, token) => {
    if (err) {
      console.error("Error signing token:", err);
      return res.status(500).json({ error: "Failed to sign token" });
    }
    res.json({ token });
  });
});

// Endpoint to add new token to Tokens.json file ==> Fourth Requirement
app.post("/tokenAddress", authenticateToken, async (req, res) => {
    try {
      const { address } = req.body;
  
      if (!address) {
        return res.status(400).json({ error: "Missing token address in request body" });
      }
  
      let updatedTokens = JSON.parse(fs.readFileSync(tokensFilePath, "utf8"));
  
      // Check if token with given address already exists
      if (!updatedTokens.tokens.find((t) => t.address === address)) {
        const response = await axios.get(
          `https://sepolia.explorer.mode.network/api/v2/tokens/${address}`
        );
        const tokenData = response.data;
        const token = {
          chainId: 919,
          address: tokenData.address,
          symbol: tokenData.symbol,
          name: tokenData.name,
          decimals: Number(tokenData.decimals),
          tags: ["ERC-20"],
        };
  
        // Add logoURI if it's not null
        if (tokenData.icon_url !== null) {
          token.logoURI = tokenData.icon_url;
        }
  
        updatedTokens.tokens.push(token);
        fs.writeFileSync(tokensFilePath, JSON.stringify(updatedTokens, null, 2));
      }
  
      res.json(updatedTokens.tokens);
    } catch (error) {
      console.error("Error fetching or adding token:", error);
      return res.status(500).json({ error: "Failed to fetch or add token" });
    }
  });  

// Start the server;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
