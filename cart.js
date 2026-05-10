// ============================================================
// DREAMERS COFFEE — カート共通ロジック (cart.js)
// 全ページで読み込む共通スクリプト
// ============================================================

const Cart = {
  // カートデータをlocalStorageから取得
  getItems() {
    try {
      return JSON.parse(localStorage.getItem('dc_cart') || '[]');
    } catch {
      return [];
    }
  },

  // カートデータを保存
  saveItems(items) {
    localStorage.setItem('dc_cart', JSON.stringify(items));
    this.updateBadge();
  },

  // カートに追加
  addItem(item) {
    // item = { id, name, variant, price, image }
    const items = this.getItems();
    const key = `${item.id}_${item.variant}`;
    const existing = items.find(i => i.key === key);
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({ ...item, key, qty: 1 });
    }
    this.saveItems(items);
    this.showToast(`${item.name}（${item.variant}）をカートに追加しました`);
  },

  // 数量変更
  updateQty(key, qty) {
    let items = this.getItems();
    if (qty <= 0) {
      items = items.filter(i => i.key !== key);
    } else {
      const item = items.find(i => i.key === key);
      if (item) item.qty = qty;
    }
    this.saveItems(items);
  },

  // 削除
  removeItem(key) {
    const items = this.getItems().filter(i => i.key !== key);
    this.saveItems(items);
  },

  // 合計金額
  getTotal() {
    return this.getItems().reduce((sum, i) => sum + i.price * i.qty, 0);
  },

  // 合計点数
  getTotalQty() {
    return this.getItems().reduce((sum, i) => sum + i.qty, 0);
  },

  // カートバッジを更新（ヘッダーのアイコン横）
  updateBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const qty = this.getTotalQty();
    badge.textContent = qty;
    badge.style.display = qty > 0 ? 'flex' : 'none';
  },

  // トースト通知
  showToast(msg) {
    let toast = document.getElementById('cart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cart-toast';
      toast.style.cssText = `
        position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
        background:#1a1a1a; color:#fff; padding:12px 24px; border-radius:4px;
        font-size:14px; z-index:9999; opacity:0; transition:opacity 0.3s;
        white-space:nowrap; pointer-events:none;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  },

  // カートアイコンHTMLを生成（ヘッダーに挿入）
  // ※ index.htmlにすでにカートアイコンがあるため無効化
  injectCartIcon() {
    return;
  }
};

// ページ読み込み時にカートアイコンを挿入してバッジ更新
document.addEventListener('DOMContentLoaded', () => {
  Cart.injectCartIcon();
  Cart.updateBadge();
});
