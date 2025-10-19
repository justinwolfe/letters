/**
 * Offline Storage Manager
 *
 * Manages IndexedDB storage for offline access to emails and images.
 */

interface Email {
  id: string;
  subject: string;
  description: string;
  publish_date: string;
  body?: string;
  image_url?: string;
  slug?: string;
  secondary_id?: number;
}

interface StorageStats {
  emailCount: number;
  imageCount: number;
  totalSize: number;
  lastSync: string | null;
}

const DB_NAME = 'thankYouNotesDB';
const DB_VERSION = 1;
const EMAILS_STORE = 'emails';
const IMAGES_STORE = 'images';
const METADATA_STORE = 'metadata';

class OfflineStorage {
  private db: IDBDatabase | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create emails store
        if (!db.objectStoreNames.contains(EMAILS_STORE)) {
          const emailStore = db.createObjectStore(EMAILS_STORE, {
            keyPath: 'id',
          });
          emailStore.createIndex('publish_date', 'publish_date', {
            unique: false,
          });
          emailStore.createIndex('subject', 'subject', { unique: false });
        }

        // Create images store
        if (!db.objectStoreNames.contains(IMAGES_STORE)) {
          db.createObjectStore(IMAGES_STORE, { keyPath: 'url' });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Save a single email
   */
  async saveEmail(email: Email): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([EMAILS_STORE], 'readwrite');
      const store = transaction.objectStore(EMAILS_STORE);
      const request = store.put(email);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save multiple emails
   */
  async saveEmails(emails: Email[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([EMAILS_STORE], 'readwrite');
      const store = transaction.objectStore(EMAILS_STORE);

      emails.forEach((email) => store.put(email));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get all emails
   */
  async getAllEmails(): Promise<Email[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([EMAILS_STORE], 'readonly');
      const store = transaction.objectStore(EMAILS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a single email by ID
   */
  async getEmail(id: string): Promise<Email | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([EMAILS_STORE], 'readonly');
      const store = transaction.objectStore(EMAILS_STORE);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save an image blob
   */
  async saveImage(url: string, blob: Blob): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IMAGES_STORE], 'readwrite');
      const store = transaction.objectStore(IMAGES_STORE);
      const request = store.put({
        url,
        blob,
        savedAt: new Date().toISOString(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get an image blob
   */
  async getImage(url: string): Promise<Blob | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IMAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMAGES_STORE);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.blob : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Set metadata value
   */
  async setMetadata(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.put({
        key,
        value,
        updatedAt: new Date().toISOString(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get metadata value
   */
  async getMetadata(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    if (!this.db) throw new Error('Database not initialized');

    const emails = await this.getAllEmails();
    const lastSync = await this.getMetadata('lastSync');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IMAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMAGES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const images = request.result;
        const totalSize = images.reduce(
          (sum, img) => sum + (img.blob?.size || 0),
          0
        );

        resolve({
          emailCount: emails.length,
          imageCount: images.length,
          totalSize,
          lastSync,
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [EMAILS_STORE, IMAGES_STORE, METADATA_STORE],
        'readwrite'
      );

      transaction.objectStore(EMAILS_STORE).clear();
      transaction.objectStore(IMAGES_STORE).clear();
      transaction.objectStore(METADATA_STORE).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Download all content for offline use
   */
  async downloadAllContent(
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<void> {
    try {
      // Detect API base
      const apiBase = (import.meta.env.VITE_API_BASE || '').startsWith(
        '/letters'
      )
        ? '/letters'
        : '';
      const isStatic = apiBase === '/letters';

      // Fetch all emails
      onProgress?.(0, 100, 'Fetching email list...');
      const emailsUrl = isStatic ? `${apiBase}/api/emails.json` : '/api/emails';
      const response = await fetch(emailsUrl);
      if (!response.ok) throw new Error('Failed to fetch emails');

      const emails: Email[] = await response.json();
      onProgress?.(10, 100, `Found ${emails.length} emails`);

      // Save email list
      await this.saveEmails(emails);
      onProgress?.(20, 100, 'Saved email list');

      // Fetch full content for each email
      const totalEmails = emails.length;
      for (let i = 0; i < totalEmails; i++) {
        const email = emails[i];
        const progress = 20 + Math.floor((i / totalEmails) * 60);
        onProgress?.(progress, 100, `Downloading ${email.subject}...`);

        const emailUrl = isStatic
          ? `${apiBase}/api/emails/${email.id}.json`
          : `/api/emails/${email.id}`;
        const emailResponse = await fetch(emailUrl);
        if (emailResponse.ok) {
          const fullEmail = await emailResponse.json();
          await this.saveEmail(fullEmail);
        }
      }

      onProgress?.(80, 100, 'Content downloaded');

      // Download images
      onProgress?.(85, 100, 'Downloading images...');
      await this.downloadImages(emails);

      // Update last sync time
      await this.setMetadata('lastSync', new Date().toISOString());

      onProgress?.(100, 100, 'Download complete!');
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  /**
   * Download all images referenced in emails
   */
  private async downloadImages(emails: Email[]): Promise<void> {
    const imageUrls = new Set<string>();

    // Extract all image URLs from emails
    emails.forEach((email) => {
      if (email.image_url) imageUrls.add(email.image_url);

      // Parse body for image URLs
      if (email.body) {
        const imgRegex = /!\[.*?\]\((.*?)\)/g;
        let match;
        while ((match = imgRegex.exec(email.body)) !== null) {
          imageUrls.add(match[1]);
        }
      }
    });

    // Download each image
    const urls = Array.from(imageUrls);
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          await this.saveImage(url, blob);
        }
      } catch (error) {
        console.warn(`Failed to download image: ${url}`, error);
      }
    }
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorage();

// Helper to format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
