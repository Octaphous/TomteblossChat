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

const history = [];
function addToHistory(role, content) {
    history.push({ role, content });
    if (history.length > config.max_history) history.shift();
}

discordBot.on("messageCreate", async (message) => {
    if (message.author.bot || !config.channel_ids.includes(message.channel.id)) return;

    let messageText = message.cleanContent.trim().substring(0, config.max_message_length);
    if (messageText.length === 0) return;

    const messageAuthor = await message.guild.members.fetch(message.author);
    addToHistory("user", encodeMessage(messageText, messageAuthor.displayName));

    // Get the response from OpenAI
    const chatCompletion = await openai
        .createChatCompletion({
            model: "gpt-3.5-turbo-0301",
            max_tokens: config.max_tokens,
            messages: [{ role: "system", content: config.ai_system_instruction }, ...history],
        })
        .catch((err) => {
            console.error(err.message);
        });

    if (!chatCompletion || chatCompletion?.data?.error) {
        return message.channel.send(config.error_msg);
    }

    const response = decodeMessage(chatCompletion.data.choices[0].message.content);
    console.log(`MSG: ${message.content}\nAI: ${response}\n-----------------`);

    if (config.assistant_history) {
        addToHistory("assistant", encodeMessage(response, config.assistant_name || "Assistant"));
    }

    message.channel.sendTyping();

    setTimeout(() => {
        message.channel.send(response);
    }, 2500);
});

function encodeMessage(text, username) {
    let encoded = `${username}:`;
    for (const line of text.trim().split(/\r?\n/)) encoded += `\n | ${line}`;
    return encoded;
}

function decodeMessage(encoded) {
    return encoded.replace(/^.+?:\s*?\n?/, "").replace(/^\s*\|\s?/gm, "");
}
