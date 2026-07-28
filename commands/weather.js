
// commands/weather.js
const axios = require("axios");

// Standalone weather command
async function weatherCommand(sock, chatId, message, q) {
  try {
    if (!q) {
      return await sock.sendMessage(
        chatId,
        { text: "❗ Please provide a city name.\n\n📌 Example: `.weather Kampala`"},
        { quoted: message }
      );
    }

    // 🔑 Use your OpenWeather API key
    const apiKey = "2d61a72574c11c4f36173b627f8cb177";
    const city = q.trim();
    const url = `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${apiKey}&units=metric`;

    const response = await axios.get(url);
    const weather = response.data;

    const weatherReport = `
╭━━〔 WEATHER REPORT 〕━━╮
┃ 📍 *Location:* ${weather.name}, ${weather.sys.country}
┃ 🌡️ *Temp:* ${weather.main.temp}°C 
┃ 🌡️ *Feels like:* ${weather.main.feels_like}°C
┃ 🌡️ *Min Temp:* ${weather.main.temp_min}°C
┃ 🌡️ *Max Temp:* ${weather.main.temp_max}°C
┃ ☁️ *Weather:* ${weather.weather[0].main}
┃ 📝 *Condition:* ${weather.weather[0].description}
┃ 💧 *Humidity:* ${weather.main.humidity}%
┃ 🌬️ *Wind Speed:* ${weather.wind.speed} m/s, ${weather.wind.deg}°
┃ 🌪️ *Pressure:* ${weather.main.pressure} hPa
┃ 🌅 *Sunrise:* ${new Date(weather.sys.sunrise * 1000).toLocaleTimeString()}
┃ 🌇 *Sunset:* ${new Date(weather.sys.sunset * 1000).toLocaleTimeString()}
╰═❀════════════════❀═╯

> *Powered By ᴍᴀɴɪ ᴍᴅ ☘*`;


      const contextInfo = {
  forwardingScore: 1,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363429143452524@newsletter',
    newsletterName: 'ᴍᴀɴɪ ᴍᴅ ☘',
    serverMessageId: -1
  }
};
   




    await sock.sendMessage(chatId, { text: weatherReport, contextInfo
    }, { quoted: message });
  } catch (e) {
    console.error("weatherCommand error:", e.message || e);

    if (e.response && e.response.status === 404) {
      return await sock.sendMessage(
        chatId,
        { text: "🚫 City not found. Please check the spelling and try again."
         },
        { quoted: message }
      );
    }

    await sock.sendMessage(
      chatId,
      { text: "⚠️ An error occurred while fetching weather info. Please try again later."
       },
      { quoted: message }
    );
  }
}

module.exports = weatherCommand;
