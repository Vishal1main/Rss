const { Telegraf } = require('telegraf');
const Jimp = require('jimp');
const axios = require('axios');

// Bot token, replace with your bot's token
const bot = new Telegraf('7861502352:AAHUujFPIjeyzVhJb0ANTeWm-S6kcVWXLds');

// User settings in memory (you may want to use a database instead of in-memory storage)
let userSettings = {};

// Function to get user settings
function getUserSettings(userId) {
  if (!userSettings[userId]) {
    userSettings[userId] = { 
      text: 'Watermark', 
      fontSize: 32, 
      fontColor: 'WHITE', 
      fontStyle: 'FONT_SANS', 
      position: 'left'
    };
  }
  return userSettings[userId];
}

// Show settings menu
function showSettingsMenu(ctx) {
  const settings = getUserSettings(ctx.from.id);
  const text = `Settings Menu:\nWatermark Text: ${settings.text}\nFont Size: ${settings.fontSize}\nFont Color: ${settings.fontColor}\nPosition: ${settings.position}`;
  
  ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Watermark Text', callback_data: 'change_text' }],
        [{ text: 'Font Size', callback_data: 'change_size' }],
        [{ text: 'Font Color', callback_data: 'change_color' }],
        [{ text: 'Font Style', callback_data: 'change_font_style' }],
        [{ text: 'Position', callback_data: 'change_position' }]
      ]
    }
  });
}

// Handle /settings command
bot.command('settings', (ctx) => {
  showSettingsMenu(ctx);
});

// Handle button actions
bot.action('change_text', (ctx) => {
  ctx.session = { awaiting: 'text' };
  ctx.editMessageText('Send new watermark text:');
  ctx.answerCbQuery();
});

bot.action('change_size', (ctx) => {
  ctx.session = { awaiting: 'size' };
  ctx.editMessageText('Send new font size (e.g. 32):');
  ctx.answerCbQuery();
});

bot.action('change_color', (ctx) => {
  ctx.editMessageText('Choose font color:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'White', callback_data: 'color_WHITE' }],
        [{ text: 'Black', callback_data: 'color_BLACK' }],
        [{ text: 'Red', callback_data: 'color_RED' }]
      ]
    }
  });
  ctx.answerCbQuery();
});

bot.action('change_font_style', (ctx) => {
  ctx.editMessageText('Choose font style:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Normal', callback_data: 'font_FONT_SANS' }],
        [{ text: 'Bold', callback_data: 'font_FONT_SANS_BOLD' }],
        [{ text: 'Italic', callback_data: 'font_FONT_SANS_ITALIC' }]
      ]
    }
  });
  ctx.answerCbQuery();
});

bot.action('change_position', (ctx) => {
  ctx.editMessageText('Choose watermark position:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Left', callback_data: 'position_left' }],
        [{ text: 'Center', callback_data: 'position_center' }],
        [{ text: 'Right', callback_data: 'position_right' }]
      ]
    }
  });
  ctx.answerCbQuery();
});

// Update user settings based on action
bot.action(/^font_(.+)/, (ctx) => {
  const userId = ctx.from.id;
  const font = ctx.match[1];
  getUserSettings(userId).fontStyle = font;
  ctx.reply(`✅ Font style set to ${font.replace('FONT_SANS_', '')}`);
  showSettingsMenu(ctx);
  ctx.answerCbQuery();
});

bot.action(/^color_(.+)/, (ctx) => {
  const userId = ctx.from.id;
  const color = ctx.match[1];
  getUserSettings(userId).fontColor = color;
  ctx.reply(`✅ Font color set to ${color}`);
  showSettingsMenu(ctx);
  ctx.answerCbQuery();
});

bot.action(/^position_(.+)/, (ctx) => {
  const userId = ctx.from.id;
  const position = ctx.match[1];
  getUserSettings(userId).position = position;
  ctx.reply(`✅ Position set to ${position}`);
  showSettingsMenu(ctx);
  ctx.answerCbQuery();
});

// Handle the text input for watermark text and font size
bot.on('text', (ctx) => {
  const userId = ctx.from.id;
  const setting = ctx.session?.awaiting;
  const input = ctx.message.text.trim();

  if (setting === 'text') {
    getUserSettings(userId).text = input;
    ctx.reply(`✅ Watermark text set to: "${input}"`);
  } else if (setting === 'size') {
    const size = parseInt(input);
    if (!isNaN(size)) {
      getUserSettings(userId).fontSize = size;
      ctx.reply(`✅ Font size set to: ${size}`);
    } else {
      ctx.reply('Invalid font size!');
    }
  }

  ctx.session = null;
  showSettingsMenu(ctx);
});

// Handle photo uploads
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const settings = getUserSettings(userId);

  // 1. Show processing message
  const waitMsg = await ctx.reply('⏳ Processing your image, please wait...');

  try {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const fileUrl = await ctx.telegram.getFileLink(fileId);

    const response = await axios.get(fileUrl.href, { responseType: 'arraybuffer' });
    const image = await Jimp.read(response.data);

    // Load font with user's selected settings
    let fontPath;
    try {
      const style = settings.fontStyle || 'FONT_SANS';
      const size = settings.fontSize || 32;
      const color = settings.fontColor || 'WHITE';
      fontPath = Jimp[`${style}_${size}_${color}`] || Jimp.FONT_SANS_32_WHITE;
    } catch {
      fontPath = Jimp.FONT_SANS_32_WHITE;
    }
    const font = await Jimp.loadFont(fontPath);

    // Positioning logic
    const text = settings.text || 'Watermark';
    const textWidth = Jimp.measureText(font, text);
    const textHeight = Jimp.measureTextHeight(font, text, image.bitmap.width);

    let x = 10, y = 10;
    if (settings.position === 'center') {
      x = (image.bitmap.width - textWidth) / 2;
      y = (image.bitmap.height - textHeight) / 2;
    } else if (settings.position === 'right') {
      x = image.bitmap.width - textWidth - 10;
      y = image.bitmap.height - textHeight - 10;
    }

    image.print(font, x, y, text);

    const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);
    
    // 2. Delete "processing" message
    await ctx.deleteMessage(waitMsg.message_id);

    // 3. Send watermarked image
    await ctx.replyWithPhoto({ source: buffer }, { caption: '✅ Watermark added!' });

  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Failed to process image.');
  }
});

// Start bot
bot.launch();
