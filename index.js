const axios = require('axios');
const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;

const scanInterval = 3600000;

app.use(express.json());

const fetchTokens = async () => {
    try {
        const response = await axios.get('https://sepolia.explorer.mode.network/api/v2/tokens?type=ERC-20');
        return response.data;
    } catch (error) {
        console.error('Error fetching tokens:', error);
        return [];
    }
};

// Schedule periodic updates
setInterval(fetchTokens, scanInterval);

app.get('/', async (req, res) => {
  res.json({ message: 'it is working' });
});

// Endpoint to get the token list
app.get('/tokens', async (req, res) => {
    try {
        let updatedTokens = JSON.parse(fs.readFileSync('/updatedToken.json', 'utf8'));

        // let data = await fetchTokens();

        // Add new tokens with our structure
        // data.items.forEach(item => {
        //     const token = {
        //         chainId: 919,
        //         address: item.address,
        //         symbol: item.symbol,
        //         name: item.name,
        //         decimals: Number(item.decimals),
        //         tags: ['ERC-20']
        //     };

            // Add logoURI if it's not null
            // if (item.icon_url !== null) {
            //     token.logoURI = item.icon_url;
            // }

            //find the token in the updatedTokens and ensure that duplicate token can't be added
        //     if (
        //         !updatedTokens.tokens.find(
        //             t => t.address === token.address && t.symbol === token.symbol && t.name === token.name
        //         )
        //     ) {
        //         updatedTokens.tokens.push(token);
        //     }
        // });

        // fs.writeFileSync('updatedToken.json', JSON.stringify(updatedTokens, null, 2));

        res.json(updatedTokens);
    } catch (error) {
        console.error('Error getting token list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const tokenListPath = 'updatedToken.json';

// Endpoint to update the logoURI of a token
app.post('/addlogoURI', (req, res) => {
  try {
    const { address, url } = req.body;

    if (!address || !url) {
      return res.status(400).json({ error: 'Missing address or URL in request body' });
    }

    fs.readFile(tokenListPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading token list:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      let tokenList = JSON.parse(data);
      const tokenIndex = tokenList.tokens.findIndex(token => token.address === address);
      if (tokenIndex === -1) {
        return res.status(404).json({ error: 'Token not found' });
      }

      tokenList.tokens[tokenIndex].logoURI = url;
      fs.writeFile(tokenListPath, JSON.stringify(tokenList, null, 2), (err) => {
        if (err) {
          console.error('Error writing token list:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ message: 'LogoURI updated successfully' });
      });
    });
  } catch (error) {
    console.error('Error updating logoURI:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});