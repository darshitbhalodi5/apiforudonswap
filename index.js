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
//     try {
//         let tokens = [];
//         let nextPageParams = null;

//         // Fetch tokens until there are no more pages
//         while (true) {
//             const url = nextPageParams
//                 ? `https://sepolia.explorer.mode.network/api/v2/tokens?type=ERC-20&contract_address_hash=${nextPageParams.contract_address_hash}`
//                 : 'https://sepolia.explorer.mode.network/api/v2/tokens?type=ERC-20';

//             const response = await axios.get(url);
//             const data = response.data;

//             // Add tokens to the list
//             tokens = tokens.concat(data.items);

//             // Check if there are more pages
//             if (data.next_page_params) {
//                 nextPageParams = data.next_page_params;
//             } else {
//                 break;
//             }
//         }

//         return tokens;
//     } catch (error) {
//         console.error('Error fetching tokens:', error.message);
//         throw new Error('Failed to fetch tokens');
//     }
// }

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

// Start the server;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
