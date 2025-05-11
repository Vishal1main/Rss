const { Telegraf } = require('telegraf');
const axios = require('axios');
const Jimp = require('jimp');
const fs = require('fs');
const express = require('express');

// Bot token directly here
const BOT_TOKEN = '7861502352:AAHUujFPIjeyzVhJb0ANTeWm-S6kcVWXLds'; // << Replace this with your actual token

const bot = new Telegraf(BOT_TOKEN);

// /start command
bot.start((ctx) => {
  ctx.reply('Welcome! Send me any landscape poster, and I’ll send it back with a watermark.');
});

// Handle photo upload
bot.on('photo', async (ctx) => {
  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    const file = await ctx.telegram.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const response = await axios({ url, responseType: 'arraybuffer' });
    const image = await Jimp.read(response.data);

    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

    // Watermark settings
    const watermarkText = 'YourWatermark'; // Change this to your watermark
    const padding = 20;

    const textWidth = Jimp.measureText(font, watermarkText);
    const textHeight = Jimp.measureTextHeight(font, watermarkText, textWidth);

    const bgWidth = textWidth + padding * 2;
    const bgHeight = textHeight + padding * 2;

    const bgX = (image.bitmap.width - bgWidth) / 2;
    const bgY = image.bitmap.height - bgHeight - 20; // 20px above bottom

    // Create black transparent background
    const background = new Jimp(bgWidth, bgHeight, 0x00000080); // black with transparency
    image.composite(background, bgX, bgY);

    // Print white text on top of background
    image.print(
      font,
      bgX + padding,
      bgY + padding,
      {
        text: watermarkText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
      },
      textWidth,
      textHeight
    );

    const outputPath = 'watermarked.jpg';
    await image.quality(90).writeAsync(outputPath);

    await ctx.replyWithPhoto({ source: outputPath }, { caption: 'Watermarked Poster' });
    fs.unlinkSync(outputPath); // clean temp file
  } catch (err) {
    console.error(err);
    ctx.reply('Failed to process image.');
  }
});

// Start bot
bot.launch();

// Required for Render port listening
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running...'));
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
