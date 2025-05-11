const { Telegraf } = require('telegraf');
const Jimp = require('jimp');
const axios = require('axios');

const bot = new Telegraf('7861502352:AAHUujFPIjeyzVhJb0ANTeWm-S6kcVWXLds');

// In-memory user settings
let userSettings = {};
let userSessions = {};

// Default settings per user
function getUserSettings(userId) {
  if (!userSettings[userId]) {
    userSettings[userId] = {
      text: 'Watermark',
      fontSize: 32,
      fontColor: 'WHITE',
      fontStyle: 'SANS',
      position: 'left'
    };
  }
  return userSettings[userId];
}

// Helper to map size to Jimp font constant
function getFont(fontStyle, fontSize, fontColor) {
  const style = fontStyle.toUpperCase();
  const sizeMap = { 8: 8, 16: 16, 32: 32, 64: 64, 128: 128 };
  const validSizes = [8, 16, 32, 64, 128];
  const closestSize = validSizes.reduce((prev, curr) => (
    Math.abs(curr - fontSize) < Math.abs(prev - fontSize) ? curr : prev
  ));

  const color = fontColor.toUpperCase();
  return Jimp[`FONT_${style}_${closestSize}_${color}`];
}

// /settings command
bot.command('settings', (ctx) => {
  const settings = getUserSettings(ctx.from.id);
  const message = `Settings Menu:\n\nWatermark Text: ${settings.text}\nFont Size: ${settings.fontSize}\nFont Color: ${settings.fontColor}\nFont Style: ${settings.fontStyle}\nPosition: ${settings.position}`;
  ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Watermark Text', callback_data: 'change_text' }],
        [{ text: 'Font Size', callback_data: 'change_font_size' }],
        [{ text: 'Font Color', callback_data: 'change_font_color' }],
        [{ text: 'Font Style', callback_data: 'change_font_style' }],
        [{ text: 'Position', callback_data: 'change_position' }]
      ]
    }
  });
});

// Handle each setting change
bot.action('change_text', (ctx) => {
  userSessions[ctx.from.id] = 'awaiting_text';
  ctx.editMessageText('Send new watermark text:');
});

bot.action('change_font_size', (ctx) => {
  const buttons = [
    [{ text: '8', callback_data: 'font_size_8' }, { text: '16', callback_data: 'font_size_16' }, { text: '32', callback_data: 'font_size_32' }],
    [{ text: '64', callback_data: 'font_size_64' }, { text: '128', callback_data: 'font_size_128' }]
  ];
  ctx.editMessageText('Select font size:', { reply_markup: { inline_keyboard: buttons } });
});

bot.action(/^font_size_(\d+)/, (ctx) => {
  const size = parseInt(ctx.match[1]);
  getUserSettings(ctx.from.id).fontSize = size;
  ctx.editMessageText(`✅ Font size set to ${size}`);
});

bot.action('change_font_color', (ctx) => {
  const buttons = [
    [{ text: 'White', callback_data: 'color_WHITE' }, { text: 'Black', callback_data: 'color_BLACK' }, { text: 'Red', callback_data: 'color_RED' }]
  ];
  ctx.editMessageText('Choose font color:', { reply_markup: { inline_keyboard: buttons } });
});

bot.action(/^color_(.+)/, (ctx) => {
  getUserSettings(ctx.from.id).fontColor = ctx.match[1];
  ctx.editMessageText(`✅ Font color set to ${ctx.match[1]}`);
});

bot.action('change_font_style', (ctx) => {
  const buttons = [
    [{ text: 'Sans', callback_data: 'style_SANS' }]
    // More styles can be added if supported by Jimp
  ];
  ctx.editMessageText('Choose font style:', { reply_markup: { inline_keyboard: buttons } });
});

bot.action(/^style_(.+)/, (ctx) => {
  getUserSettings(ctx.from.id).fontStyle = ctx.match[1];
  ctx.editMessageText(`✅ Font style set to ${ctx.match[1]}`);
});

bot.action('change_position', (ctx) => {
  const buttons = [
    [{ text: 'Left', callback_data: 'position_left' }, { text: 'Center', callback_data: 'position_center' }, { text: 'Right', callback_data: 'position_right' }]
  ];
  ctx.editMessageText('Choose position:', { reply_markup: { inline_keyboard: buttons } });
});

bot.action(/^position_(.+)/, (ctx) => {
  getUserSettings(ctx.from.id).position = ctx.match[1];
  ctx.editMessageText(`✅ Watermark position set to ${ctx.match[1]}`);
});

// Text input for watermark
bot.on('text', (ctx) => {
  const session = userSessions[ctx.from.id];
  if (session === 'awaiting_text') {
    getUserSettings(ctx.from.id).text = ctx.message.text;
    ctx.reply(`✅ Watermark text set to "${ctx.message.text}"`);
    userSessions[ctx.from.id] = null;
  }
});

// Handle photo
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const settings = getUserSettings(userId);
  const waitMsg = await ctx.reply('⏳ Processing image...');

  try {
    const file = ctx.message.photo.pop();
    const link = await ctx.telegram.getFileLink(file.file_id);
    const response = await axios.get(link.href, { responseType: 'arraybuffer' });
    const image = await Jimp.read(response.data);

    const font = await Jimp.loadFont(getFont(settings.fontStyle, settings.fontSize, settings.fontColor));
    const text = settings.text;

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

    await ctx.deleteMessage(waitMsg.message_id);
    await ctx.replyWithPhoto({ source: buffer }, { caption: '✅ Watermark added!' });

  } catch (err) {
    console.error(err);
    await ctx.reply('❌ Error processing image.');
  }
});

// Launch the bot
bot.launch();
