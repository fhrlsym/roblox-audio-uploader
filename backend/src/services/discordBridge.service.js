import { EventEmitter } from 'events';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BACKEND_ROOT } from '../config.js';

// ============================================================
// Discord Bridge Bot
// ============================================================
// Bot ini "menonton" channel Discord tempat Sound Downloader bot
// mem-posting file hasil /download. Saat file muncul, bot mengunduh
// attachment-nya, menyimpan ke /uploads, lalu mentrigger pending
// request dari website.
//
// Konfigurasi via env:
//   DISCORD_BOT_TOKEN   - token bot bridge (dari Discord Developer Portal)
//   DISCORD_CHANNEL_ID  - ID channel tempat Sound Downloader berinteraksi
//   DISCORD_DOWNLOADER_USER_ID - (opsional) user ID bot Sound Downloader,
//                                agar hanya file dari bot itu yang diproses
// ============================================================

class DiscordBridge extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.ready = false;
    this.status = { connected: false, channel: null, error: null };
    this.pending = new Map(); // assetId -> { listeners, receivedAt }
  }

  async init() {
    const token = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!token || !channelId) {
      this.status.error = 'DISCORD_BOT_TOKEN atau DISCORD_CHANNEL_ID belum di-set di env backend.';
      this.emit('status', this.status);
      return;
    }

    try {
      const { Client, GatewayIntentBits, Partials } = await import('discord.js');
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
        partials: [Partials.Channel, Partials.Message],
      });

      this.client.on('clientReady', () => {
        this.ready = true;
        const ch = this.client.channels.cache.get(channelId);
        this.status = {
          connected: true,
          channel: ch ? ch.name || channelId : channelId,
          error: null,
        };
        this.emit('status', this.status);
        console.log(`[DiscordBridge] Ready. Watching #${this.status.channel}`);
      });

      this.client.on('messageCreate', (message) => this._handleMessage(message));

      this.client.on('error', (err) => {
        this.status.error = err.message || 'Koneksi Discord error';
        this.emit('status', this.status);
        console.error('[DiscordBridge] error:', err.message);
      });

      await this.client.login(token);
    } catch (err) {
      this.status.error = `Gagal login Discord: ${err.message || err}`;
      this.emit('status', this.status);
      console.error('[DiscordBridge] init error:', err);
    }
  }

  _handleMessage(message) {
    if (!this.ready) return;
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (message.channelId !== channelId) return;

    // Filter: hanya attachment (file) yang diproses, bukan teks biasa.
    const attachments = message.attachments?.size > 0
      ? [...message.attachments.values()]
      : [];

    if (attachments.length === 0) return;

    // Opsional: hanya dari bot Sound Downloader
    const downloaderId = process.env.DISCORD_DOWNLOADER_USER_ID;
    if (downloaderId && String(message.author.id) !== String(downloaderId)) return;

    for (const att of attachments) {
      this._processAttachment(message, att);
    }
  }

  async _processAttachment(message, attachment) {
    const name = (attachment.name || '').toLowerCase();
    const size = attachment.size;
    const channelId = message.channelId;

    // Simpan file
    const uploadsDir = join(BACKEND_ROOT, 'uploads');
    if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

    const safeName = (attachment.name || `discord_${Date.now()}`).replace(/[^\w.\-]/g, '_');
    const filePath = join(uploadsDir, safeName);
    const assetIdHint = this._extractAssetId(attachment.name) || this._extractAssetId(message.content);

    try {
      const res = await fetch(attachment.url);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(filePath, buf);

      const record = {
        assetId: assetIdHint,
        fileName: attachment.name || safeName,
        filePath,
        size,
        channelId,
        receivedAt: Date.now(),
        url: `/uploads/${safeName}`,
      };
      this.emit('file', record);
      console.log(`[DiscordBridge] File diterima: ${attachment.name} (${size} bytes)${assetIdHint ? ` untuk asset ${assetIdHint}` : ''}`);
    } catch (err) {
      console.error('[DiscordBridge] Gagal mengunduh attachment:', err.message);
    }
  }

  _extractAssetId(text) {
    if (!text) return null;
    const m = String(text).match(/(?:asset_id[:=]\s*|^|\D)(\d{7,18})(?:\D|$)/);
    // hindari ID Discord (18 digit mulai 1 bertabrakan) — ambil yang 7-15 umum Roblox
    const nums = String(text).match(/\d{7,15}/g);
    if (!nums) return null;
    // prefer yang ada di nama file setelah "asset" atau angka terakhir
    return nums[0] || null;
  }

  getStatus() {
    return this.status;
  }

  // Kirim perintah download ke channel secara otomatis.
  // Banyak bot Discord merespons isi pesan yang dikirim ke channel,
  // sehingga bridge bot bisa memicu Sound Downloader tanpa user ke Discord.
  async sendCommand(assetId) {
    if (!this.ready || !this.client) {
      return { success: false, error: 'Bridge bot belum terhubung.' };
    }
    const channelId = process.env.DISCORD_CHANNEL_ID;
    try {
      const channel = this.client.channels.cache.get(channelId);
      if (!channel) {
        return { success: false, error: 'Channel Discord tidak ditemukan.' };
      }
      const msg = `/download asset_id:${assetId}`;
      await channel.send(msg);
      return { success: true, message: msg };
    } catch (err) {
      return { success: false, error: err.message || 'Gagal mengirim perintah ke Discord.' };
    }
  }
}

export const discordBridge = new DiscordBridge();