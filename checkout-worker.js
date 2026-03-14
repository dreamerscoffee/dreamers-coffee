// ============================================================
// Cloudflare Worker — Stripe Checkout セッション作成
// ファイル名: checkout-worker.js
//
// 【デプロイ手順】
// 1. https://workers.cloudflare.com/ でWorkerを新規作成
// 2. このコードを貼り付ける
// 3. Settings > Variables > Secret で以下を設定:
//    STRIPE_SECRET_KEY = sk_live_xxxxxxx（本番）or sk_test_xxxxxxx（テスト）
// 4. Workerのドメイン（〜.workers.dev）をcart.htmlのWORKER_URLに設定
// ============================================================

// ============================================================
// ★商品マスタ — Stripeの商品IDと価格を設定してください
//
// 手順:
//   1. Stripe Dashboard > 商品カタログ で商品を作成
//   2. 各商品の「料金ID」（price_xxxxx）をここに記載
//
// キーの形式: `${productId}_${variant}`
// ============================================================
const PRICE_MAP = {
  // 珈琲豆 105g
  'beans100_グアテマラ':         'price_XXXXXXXXXXXXXXXXXX',
  'beans100_メキシコ':           'price_1T8E2FR1w8hlThY3SU5eyztZ',
  'beans100_パプアニューギニア': 'price_XXXXXXXXXXXXXXXXXX',
  'beans100_ペルー':             'price_1TAppdR1w8hlThY39Od1kAl9',
  'beans100_ミャンマー':         'price_XXXXXXXXXXXXXXXXXX',
  'beans100_インドネシア':       'price_XXXXXXXXXXXXXXXXXX',
  'beans100_デカフェ':           'price_XXXXXXXXXXXXXXXXXX',

  // 珈琲豆 210g
  'beans210_グアテマラ':         'price_XXXXXXXXXXXXXXXXXX',
  'beans210_メキシコ':           'price_XXXXXXXXXXXXXXXXXX',
  'beans210_パプアニューギニア': 'price_XXXXXXXXXXXXXXXXXX',
  'beans210_ペルー':             'price_XXXXXXXXXXXXXXXXXX',
  'beans210_ミャンマー':         'price_XXXXXXXXXXXXXXXXXX',
  'beans210_インドネシア':       'price_XXXXXXXXXXXXXXXXXX',
  'beans210_デカフェ':           'price_XXXXXXXXXXXXXXXXXX',

  // 珈琲バッグ 5袋セット
  'bag_グアテマラ':              'price_XXXXXXXXXXXXXXXXXX',
  'bag_メキシコ':                'price_XXXXXXXXXXXXXXXXXX',
  'bag_パプアニューギニア':      'price_XXXXXXXXXXXXXXXXXX',
  'bag_ペルー':                  'price_XXXXXXXXXXXXXXXXXX',
  'bag_ミャンマー':              'price_XXXXXXXXXXXXXXXXXX',
  'bag_インドネシア':            'price_XXXXXXXXXXXXXXXXXX',
  'bag_デカフェ':                'price_XXXXXXXXXXXXXXXXXX',

  // 季節限定（種類が決まったら追加）
  'seasonal_通常':               'price_XXXXXXXXXXXXXXXXXX',
};

// サイトのURL（本番）
const SITE_URL = 'https://www.dreamerscoffee.shop';

// ============================================================
// Workerのメインハンドラ
// ============================================================
export default {
  async fetch(request, env) {
    // CORS ヘッダー（サイトのドメインからのリクエストを許可）
    const corsHeaders = {
      'Access-Control-Allow-Origin': SITE_URL,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // プリフライトリクエスト
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // POST /create-checkout
    if (request.method === 'POST' && url.pathname === '/create-checkout') {
      return handleCheckout(request, env, corsHeaders);
    }

    return new Response('Not Found', { status: 404 });
  }
};

// ============================================================
// Stripe Checkoutセッションを作成してURLを返す
// ============================================================
async function handleCheckout(request, env, corsHeaders) {
  try {
    const { items } = await request.json();

    if (!items || items.length === 0) {
      return jsonError('カートが空です', 400, corsHeaders);
    }

    // line_itemsを構築
    const line_items = [];
    for (const item of items) {
      const priceId = PRICE_MAP[item.key];
      if (!priceId || priceId.startsWith('price_XXXX')) {
        return jsonError(
          `商品「${item.name}（${item.variant}）」の価格IDが設定されていません`,
          400, corsHeaders
        );
      }
      line_items.push({
        price: priceId,
        quantity: item.qty,
      });
    }

    // Stripe Checkout API を呼び出す
    const body = new URLSearchParams({
      mode: 'payment',
      'success_url': `${SITE_URL}/order-complete.html?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${SITE_URL}/cart.html`,
      'locale': 'ja',
      // 配送先住所を収集
      'shipping_address_collection[allowed_countries][0]': 'JP',
      // 配送オプション（送料）
      'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
      'shipping_options[0][shipping_rate_data][fixed_amount][amount]': '600',
      'shipping_options[0][shipping_rate_data][fixed_amount][currency]': 'jpy',
      'shipping_options[0][shipping_rate_data][display_name]': '通常配送',
      // 自動税計算（Stripeダッシュボードで設定が必要）
      // 'automatic_tax[enabled]': 'true',
    });

    // line_itemsを追加
    line_items.forEach((item, i) => {
      body.append(`line_items[${i}][price]`, item.price);
      body.append(`line_items[${i}][quantity]`, String(item.quantity));
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error('Stripe error:', session);
      return jsonError(session.error?.message || 'Stripeエラー', 500, corsHeaders);
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (e) {
    console.error(e);
    return jsonError('サーバーエラーが発生しました', 500, corsHeaders);
  }
}

function jsonError(message, status, corsHeaders) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}
