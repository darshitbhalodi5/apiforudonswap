const axios = require("axios");
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const app = express();
const port = 3000;

const scanInterval = 3600000;

app.use(express.json());
app.use(cors());
// {
//   "chainId": 919,
//   "address": "0xF7ca2401709BC01Eba07d46c8d59e865C983e1AC",
//   "symbol": "LAMP",
//   "name": "Pixar Lamps",
//   "decimals": 18,
//   "logoURI": "https://roll-token.s3.amazonaws.com/AIN/b588d1ee-ea2f-47fe-a591-94f12622bc63",
//   "tags": [
//     "defi"
//   ]
// },

const fetchTokens = async () => {
  try {
    const response = await axios.get(
      "https://sepolia.explorer.mode.network/api/v2/tokens?type=ERC-20"
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return [];
  }
};

// Schedule periodic updates
let tokenDetails = require("./updatedToken.json");
setInterval(fetchTokens, scanInterval);
// Endpoint to get the token list
app.get("/tokens.json", async (req, res) => {
  try {
    const tokenFilePath = path.join(__dirname, "updatedToken.json");
    let updatedTokens = JSON.parse(fs.readFileSync(tokenFilePath, "utf8"));

    let data = await fetchTokens();

    // Add new tokens with our structure
    data.items.forEach((item) => {
      const token = {
        chainId: 919,
        address: item.address,
        symbol: item.symbol,
        name: item.name,
        decimals: Number(item.decimals),
        tags: ["defi"],
      };

      // Add logoURI if it's not null
      if (item.icon_url !== null) {
        token.logoURI = item.icon_url;
      }

      // find the token in the updatedTokens and ensure that duplicate token can't be added
      if (
        !updatedTokens.tokens.find(
          (t) =>
            t.address === token.address &&
            t.symbol === token.symbol &&
            t.name === token.name
        )
      ) {
        updatedTokens.tokens.push(token);
      }
    });

    fs.writeFileSync(tokenFilePath, JSON.stringify(updatedTokens, null, 2));

    // updatedTokens = JSON.parse(fs.readFileSync(tokenFilePath, "utf8"));
    // console.log('tokenDetails',tokenDetails);
    // res.json(updatedTokens);
   
    // res.json(updatedTokens);
    res.sendFile(tokenFilePath);

  } catch (error) {
    console.error("Error getting token list:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/updatedtokens", async (req, res) => {
  res.json(tokenDetails);
});

const tokenListPath = "updatedToken.json";

// Endpoint to update the logoURI of a token
app.post("/addlogoURI", (req, res) => {
  try {
    const { address, url } = req.body;

    if (!address || !url) {
      return res
        .status(400)
        .json({ error: "Missing address or URL in request body" });
    }

    fs.readFile(tokenListPath, "utf8", (err, data) => {
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
      fs.writeFile(tokenListPath, JSON.stringify(tokenList, null, 2), (err) => {
        if (err) {
          console.error("Error writing token list:", err);
          return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "LogoURI updated successfully" });
      });
    });
  } catch (error) {
    console.error("Error updating logoURI:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
