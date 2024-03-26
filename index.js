const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const app = express();

const port = 3000;
const scanInterval = 3600000;

app.use(express.json());
app.use(cors());

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Helper function to authenticate token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
  });
}

// Construct the path to Tokens.json file
const tokensFilePath = path.join(__dirname, 'Tokens.json');

// Helper function to fetch token details from the link
const fetchTokens = async () => {
    try {
        const response = await axios.get('https://sepolia.explorer.mode.network/api/v2/tokens?type=ERC-20');
        return response.data;
    } catch (error) {
        console.error('Error fetching tokens:', error.message);
        throw new Error('Failed to fetch tokens');
    }
}

// const fetchTokens = async () => {
//   try {
//     const allTokens = [];
//     let nextPageParams = null;

//     do {
//       const url = nextPageParams
//         ? `https://sepolia.explorer.mode.network/api/v2/tokens?type=ERC-20&${new URLSearchParams(nextPageParams).toString()}`
//         : "https://sepolia.explorer.mode.network/api/v2/tokens?type=ERC-20";

//       const response = await axios.get(url);
//       const responseData = response.data;

//       // Add the tokens from the current page to the list
//       allTokens.push(...responseData.items);

//       // Check if there are more pages available
//       nextPageParams = responseData.next_page_params;
//     } while (nextPageParams);

//     return allTokens;
//   } catch (error) {
//     console.error('Error fetching tokens:', error);
//     return [];
//   }
// };

// Refresh tokens every 1 hour
setInterval(fetchTokens, scanInterval);

// Endpoint to fetch tokens from Tokens.json file ==> First Requirement 
app.get('/tokens', (req, res) => {
    try {
        // Read Tokens.json file
        const tokensFile = fs.readFileSync(tokensFilePath);
        const tokensData = JSON.parse(tokensFile);

        // Send the tokens data as the response
        res.json(tokensData);
    } catch (error) {
        console.error('Error reading Tokens.json file:', error.message);
        res.status(500).json({ error: 'Failed to fetch tokens' });
    }
});

// Endpoint to update json file if some token missing ==> Second Requirement
app.get("/tokenDetails", async (req, res) => {
    try {
        let updatedTokens = JSON.parse(fs.readFileSync(tokensFilePath, "utf8"));
        let data = await fetchTokens();
        // Add new tokens with our structure
        data.items.forEach((item) => {
            const token = {
                chainId: 919,
                address: item.address,
                symbol: item.symbol,
                name: item.name,
                decimals: Number(item.decimals),
                tags: ["ERC-20"],
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
        fs.writeFileSync(tokensFilePath, JSON.stringify(updatedTokens, null, 2));
        res.json(updatedTokens.tokens); // Return updated tokens
    } catch (error) {
        console.error("Error fetching tokens:", error);
        return res.status(500).json({ error: "Failed to fetch tokens" });
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
        fs.writeFile(tokensFilePath, JSON.stringify(tokenList, null, 2), (err) => {
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

  app.post('/login', (req, res) => {
    // Assuming you have a user object with id and username
    const user = { id: 1, username: 'Darshit' };

    // Sign the token using your secret key
    jwt.sign({ user }, process.env.SECRET_KEY, (err, token) => {
        if (err) {
            console.error('Error signing token:', err);
            return res.status(500).json({ error: 'Failed to sign token' });
        }
        res.json({ token });
    });
});

// Endpoint to add new token to Tokens.json file ==> Fourth Requirement
app.get("/tokenAddress/:address", authenticateToken, async (req, res) => {
    try {
        let updatedTokens = JSON.parse(fs.readFileSync(tokensFilePath, "utf8"));
        const tokenAddress = req.params.address;

        // Check if token with given address already exists
        if (!updatedTokens.tokens.find((t) => t.address === tokenAddress)) {
            const response = await axios.get(`https://sepolia.explorer.mode.network/api/v2/tokens/${tokenAddress}`);
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
