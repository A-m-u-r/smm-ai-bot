const axios = require('axios');
/*"claude-3-5-sonnet-20240620"*/
const askClaude = async (prompt) => {
    try {
        const response = await axios.post('http://localhost:3001/api/anthropic', {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1000,
            messages: [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        });
        return response.data;
    } catch (error) {
        console.error('Error calling Anthropic API:', error);
        throw error;
    }
};

module.exports = { askClaude };