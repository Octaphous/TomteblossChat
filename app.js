const { Client, GatewayIntentBits } = require("discord.js");
const { Configuration, OpenAIApi } = require("openai");

require("dotenv").config();
const config = require("./config");

const openai = new OpenAIApi(
    new Configuration({
        apiKey: process.env.OPENAI_SECRET,
    })
);

const discordBot = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages],
});

discordBot.login(process.env.DISCORD_BOT_TOKEN);

discordBot.on("ready", () => {
    console.log(`Logged in as ${discordBot.user.tag}!`);
});

discordBot.on("messageCreate", async (message) => {
    if (message.author.bot || !config.channel_ids.includes(message.channel.id)) return;

    // Remove mentions from the message
    message.content = message.content.replace(/<@!?\d+>/g, "").trim();

    // Check if the message is too long or too short
    if (message.content.length > config.max_message_length || message.content.length < 1) return;

    // Get the response from OpenAI
    const chatCompletion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo-0301",
        max_tokens: config.max_tokens,
        messages: [
            { role: "system", content: config.ai_system_instruction },
            { role: "user", content: message.content },
        ],
    });

    const response = chatCompletion.data.choices[0].message.content;
    console.log(`MSG: ${message.content}\nAI: ${response}\n-----------------`);

    message.channel.sendTyping();

    setTimeout(() => {
        message.channel.send(response);
    }, 2500);
});
