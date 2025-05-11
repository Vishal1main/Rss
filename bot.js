const { Telegraf } = require('telegraf');
const axios = require('axios');
const Jimp = require('jimp');
const fs = require('fs');
const express = require('express');

const BOT_TOKEN = '7861502352:AAHUujFPIjeyzVhJb0ANTeWm-S6kcVWXLds'; // Replace with your actual token
const bot = new Telegraf(BOT_TOKEN);

const userSettings = {}; // Store settings per user

// Set default settings
function getUserSettings(userId) {
  if (!userSettings[userId]) {
    userSettings[userId] = {
      text: 'YourWatermark',
      fontSize: 32,
      fontColor: 'WHITE',
      position: 'RIGHT'
    };
  }
  return userSettings[userId];
}

// /start
bot.start((ctx) => {
  ctx.reply('Welcome! Send me a landscape poster and I’ll add a watermark.\nUse /settings to customize.');
});

// /settings command
bot.command('settings', (ctx) => {
  showSettingsMenu(ctx);
});

function showSettingsMenu(ctx) {
  ctx.reply('Choose what you want to change:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Watermark Text', callback_data: 'change_text' }],
        [{ text: 'Font Size', callback_data: 'change_font_size' }],
        [{ text: 'Font Color', callback_data: 'change_font_color' }],
        [{ text: 'Watermark Position', callback_data: 'change_position' }],
      ]
    }
  });
}

// Handlers for each setting
bot.action('change_text', (ctx) => {
  ctx.reply('Send new watermark text:');
  ctx.session = { awaiting: 'text' };
  ctx.answerCbQuery();
});

bot.action('change_font_size', (ctx) => {
  ctx.reply('Send new font size (e.g. 32, 64, 128):');
  ctx.session = { awaiting: 'size' };
  ctx.answerCbQuery();
});

bot.action('change_font_color', (ctx) => {
  ctx.reply('Choose font color:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'WHITE', callback_data: 'color_WHITE' }, { text: 'BLACK', callback_data: 'color_BLACK' }],
        [{ text: 'RED', callback_data: 'color_RED' }, { text: 'BLUE', callback_data: 'color_BLUE' }]
      ]
    }
  });
  ctx.answerCbQuery();
});

bot.action(/^color_(.+)/, (ctx) => {
  const userId = ctx.from.id;
  const color = ctx.match[1];
  getUserSettings(userId).fontColor = color;
  ctx.reply(`Font color set to ${color}`);
  showSettingsMenu(ctx);
  ctx.answerCbQuery();
});

bot.action('change_position', (ctx) => {
  ctx.reply('Choose watermark position:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Left', callback_data: 'pos_LEFT' }, { text: 'Center', callback_data: 'pos_CENTER' }, { text: 'Right', callback_data: 'pos_RIGHT' }]
      ]
    }
  });
  ctx.answerCbQuery();
});

bot.action(/^pos_(.+)/, (ctx) => {
  const userId = ctx.from.id;
  const pos = ctx.match[1];
  getUserSettings(userId).position = pos;
  ctx.reply(`Watermark position set to ${pos}`);
  showSettingsMenu(ctx);
  ctx.answerCbQuery();
});

// Handle text inputs for watermark and font size
bot.on('text', (ctx) => {
  const userId = ctx.from.id;
  const setting = ctx.session?.awaiting;
  const input = ctx.message.text.trim();

  if (setting === 'text') {
    getUserSettings(userId).text = input;
    ctx.reply(`Watermark text set to: ${input}`);
  } else if (setting === 'size') {
    const size = parseInt(input);
    if (!isNaN(size)) {
      getUserSettings(userId).fontSize = size;
      ctx.reply(`Font size set to: ${size}`);
    } else {
      ctx.reply('Invalid font size!');
    }
  }

  ctx.session = null;
  showSettingsMenu(ctx);
});

// On photo received
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const settings = getUserSettings(userId);

  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    const file = await ctx.telegram.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const response = await axios({ url, responseType: 'arraybuffer' });
    const image = await Jimp.read(response.data);

    // Load font based on color
    let fontPath = Jimp[`FONT_SANS_32_${settings.fontColor}`] || Jimp.FONT_SANS_32_WHITE;
    const font = await Jimp.loadFont(fontPath);

    const textWidth = Jimp.measureText(font, settings.text);
    const textHeight = Jimp.measureTextHeight(font, settings.text, image.bitmap.width);

    let x = 20; // Left default
    if (settings.position === 'CENTER') {
      x = (image.bitmap.width - textWidth) / 2;
    } else if (settings.position === 'RIGHT') {
      x = image.bitmap.width - textWidth - 20;
    }

    const y = image.bitmap.height - textHeight - 20;
    image.print(font, x, y, settings.text);

    const outputPath = 'watermarked.jpg';
    await image.quality(90).writeAsync(outputPath);

    await ctx.replyWithPhoto({ source: outputPath }, { caption: 'Here is your watermarked image.' });
    fs.unlinkSync(outputPath);
  } catch (error) {
    console.error(error);
    ctx.reply('Failed to add watermark.');
  }
});

// Web server to keep Render alive
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running...'));
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// Launch the bot
bot.launch();
