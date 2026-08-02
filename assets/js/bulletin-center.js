"use strict";

// ============================================================
// BULLETIN SERVICE
// Uses global Firebase instances (window.db, window.auth)
// Do NOT redeclare db, auth, or firebaseConfig here.
// ============================================================

const BulletinService = {

  /**
   * Publish a new bulletin
   * @param {Object} data - { title, summary, message, category, priority, author, audience, attachments }
   * @returns {Promise<{id: string}>}
   */
  async publish(data) {
    try {
      const docRef = await window.db.collection("bulletins").add({
        ...data,
        status: "published",
        publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
        views: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { id: docRef.id };
    } catch (error) {
      console.error("Error publishing bulletin:", error);
      throw error;
    }
  },

  /**
   * Save a bulletin as draft
   * @param {Object} data - same as publish
   * @returns {Promise<{id: string}>}
   */
  async saveDraft(data) {
    try {
      const docRef = await window.db.collection("bulletins").add({
        ...data,
        status: "draft",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { id: docRef.id };
    } catch (error) {
      console.error("Error saving draft:", error);
      throw error;
    }
  },

  /**
   * Update an existing bulletin
   * @param {string} id - document ID
   * @param {Object} data - updated fields
   * @returns {Promise<{id: string}>}
   */
  async update(id, data) {
    try {
      await window.db.collection("bulletins").doc(id).update({
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { id };
    } catch (error) {
      console.error("Error updating bulletin:", error);
      throw error;
    }
  },

  /**
   * Delete a bulletin
   * @param {string} id - document ID
   * @returns {Promise<{id: string}>}
   */
  async remove(id) {
    try {
      await window.db.collection("bulletins").doc(id).delete();
      return { id };
    } catch (error) {
      console.error("Error deleting bulletin:", error);
      throw error;
    }
  },

  /**
   * Listen to published bulletins in real‑time
   * @param {function} callback - receives array of bulletins
   * @returns {function} - unsubscribe function
   */
  listenPublished(callback) {
    return window.db.collection("bulletins")
      .where("status", "==", "published")
      .orderBy("publishedAt", "desc")
      .onSnapshot((snapshot) => {
        const bulletins = [];
        snapshot.forEach(doc => {
          bulletins.push({ id: doc.id, ...doc.data() });
        });
        callback(bulletins);
      }, (error) => {
        console.error("Error listening to bulletins:", error);
      });
  },

  /**
   * Get a single bulletin by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async get(id) {
    try {
      const doc = await window.db.collection("bulletins").doc(id).get();
      if (!doc.exists) throw new Error("Bulletin not found");
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error("Error fetching bulletin:", error);
      throw error;
    }
  }
};

// Expose globally
window.BulletinService = BulletinService;
