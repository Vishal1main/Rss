const { Telegraf } = require('telegraf');
const Jimp = require('jimp');
const axios = require('axios');

// Replace with your bot token
const bot = new Telegraf('7861502352:AAHUujFPIjeyzVhJb0ANTeWm-S6kcVWXLds');

// Store user settings in memory
let userSettings = {};

function getUserSettings(userId) {
  if (!userSettings[userId]) {
    userSettings[userId] = {
      text: 'Watermark',
      fontSize: 32,
      fontColor: 'WHITE',
      fontStyle: 'FONT_SANS',
      position: 'left',
    };
  }
  return userSettings[userId];
}

// /start command
bot.start((ctx) => {
  ctx.reply('Welcome! Send an image to get it watermarked.\nUse /settings to customize font, size, and position.');
});

// /settings command
bot.command('settings', (ctx) => {
  const settings = getUserSettings(ctx.from.id);
  const message = `Settings:\nFont Size: ${settings.fontSize}\nFont Color: ${settings.fontColor}\nFont Style: ${settings.fontStyle.replace('FONT_SANS_', '')}\nPosition: ${settings.position}`;
  ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Font Size', callback_data: 'font_size' }],
        [{ text: 'Font Color', callback_data: 'font_color' }],
        [{ text: 'Font Style', callback_data: 'font_style' }],
        [{ text: 'Position', callback_data: 'position' }],
      ]
    }
  });
});

// Font size selection
bot.action('font_size', (ctx) => {
  ctx.editMessageText('Select Font Size:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '10', callback_data: 'set_size_10' },
          { text: '20', callback_data: 'set_size_20' },
          { text: '30', callback_data: 'set_size_30' },
          { text: '40', callback_data: 'set_size_40' },
          { text: '50', callback_data: 'set_size_50' },
        ],
        [
          { text: '60', callback_data: 'set_size_60' },
          { text: '70', callback_data: 'set_size_70' },
          { text: '80', callback_data: 'set_size_80' },
          { text: '90', callback_data: 'set_size_90' },
          { text: '100', callback_data: 'set_size_100' },
        ]
      ]
    }
  });
});

// Handle set_size buttons
bot.action(/^set_size_(\d+)$/, (ctx) => {
  const size = parseInt(ctx.match[1]);
  getUserSettings(ctx.from.id).fontSize = size;
  ctx.editMessageText(`✅ Font size set to ${size}`);
  ctx.answerCbQuery();
});

// Font color
bot.action('font_color', (ctx) => {
  ctx.editMessageText('Choose Font Color:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'White', callback_data: 'color_WHITE' }],
        [{ text: 'Black', callback_data: 'color_BLACK' }],
        [{ text: 'Red', callback_data: 'color_RED' }],
      ]
    }
  });
});

bot.action(/^color_(.+)/, (ctx) => {
  getUserSettings(ctx.from.id).fontColor = ctx.match[1];
  ctx.editMessageText(`✅ Font color set to ${ctx.match[1]}`);
  ctx.answerCbQuery();
});

// Font style
bot.action('font_style', (ctx) => {
  ctx.editMessageText('Choose Font Style:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Normal', callback_data: 'font_FONT_SANS' }],
        [{ text: 'Bold', callback_data: 'font_FONT_SANS_BOLD' }],
        [{ text: 'Italic', callback_data: 'font_FONT_SANS_ITALIC' }],
      ]
    }
  });
});

bot.action(/^font_(.+)/, (ctx) => {
  getUserSettings(ctx.from.id).fontStyle = ctx.match[1];
  ctx.editMessageText(`✅ Font style set to ${ctx.match[1].replace('FONT_SANS_', '')}`);
  ctx.answerCbQuery();
});

// Watermark position
bot.action('position', (ctx) => {
  ctx.editMessageText('Choose Watermark Position:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Left', callback_data: 'pos_left' }],
        [{ text: 'Center', callback_data: 'pos_center' }],
        [{ text: 'Right', callback_data: 'pos_right' }],
      ]
    }
  });
});

bot.action(/^pos_(.+)/, (ctx) => {
  getUserSettings(ctx.from.id).position = ctx.match[1];
  ctx.editMessageText(`✅ Watermark position set to ${ctx.match[1]}`);
  ctx.answerCbQuery();
});

// Handle photo with watermark
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const settings = getUserSettings(userId);

  const waitMsg = await ctx.reply('⏳ Processing your image...');

  try {
    const file = ctx.message.photo[ctx.message.photo.length - 1];
    const fileUrl = await ctx.telegram.getFileLink(file.file_id);

    const response = await axios.get(fileUrl.href, { responseType: 'arraybuffer' });
    const image = await Jimp.read(response.data);

    const fontMap = {
      'WHITE': 'WHITE',
      'BLACK': 'BLACK',
      'RED': 'RED',
    };

    const size = Math.max(8, Math.min(settings.fontSize, 128)); // Limit to Jimp sizes
    let fontKey = `FONT_SANS_${size}_${fontMap[settings.fontColor] || 'WHITE'}`;

    let font;
    try {
      font = await Jimp.loadFont(Jimp[fontKey]);
    } catch (e) {
      font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    }

    const text = settings.text || '@Sky_Hub4u';
    const textWidth = Jimp.measureText(font, text);
    const textHeight = Jimp.measureTextHeight(font, text, image.bitmap.width);

    let x = 10;
    let y = 10;
    if (settings.position === 'center') {
      x = (image.bitmap.width - textWidth) / 2;
      y = (image.bitmap.height - textHeight) / 2;
    } else if (settings.position === 'right') {
      x = image.bitmap.width - textWidth - 10;
      y = image.bitmap.height - textHeight - 10;
    }

    image.print(font, x, y, text);

    const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);

    await ctx.deleteMessage(waitMsg.message_id);
    await ctx.replyWithPhoto({ source: buffer }, { caption: '✅ Watermark added!' });

  } catch (err) {
    console.error(err);
    await ctx.reply('❌ Failed to process image.');
  }
});

// Start the bot
bot.launch();
