// ============================================================
// Cloudflare Worker — Stripe Checkout セッション作成
// ============================================================

const PRICE_MAP = {
  // 珈琲豆 100g（beans_{id}_100g）
  'beans_mexico_100g':    'price_1TVU7pR1w8hlThY34kzFS6s4',
  'beans_peru_100g':      'price_XXXXXXXXXXXXXXXXXX',
  'beans_indonesia_100g': 'price_XXXXXXXXXXXXXXXXXX',
  'beans_decaf_100g':     'price_XXXXXXXXXXXXXXXXXX',

  // 珈琲豆 150g（beans_{id}_150g）
  'beans_mexico_150g':    'price_XXXXXXXXXXXXXXXXXX',
  'beans_peru_150g':      'price_XXXXXXXXXXXXXXXXXX',
  'beans_indonesia_150g': 'price_XXXXXXXXXXXXXXXXXX',
  'beans_decaf_150g':     'price_XXXXXXXXXXXXXXXXXX',

  // 珈琲バッグ 5袋セット（coffee-bag_{variant}）
  'coffee-bag_メキシコ':    'price_XXXXXXXXXXXXXXXXXX',
  'coffee-bag_ペルー':      'price_XXXXXXXXXXXXXXXXXX',
  'coffee-bag_インドネシア': 'price_XXXXXXXXXXXXXXXXXX',
  'coffee-bag_カフェインレス': 'price_XXXXXXXXXXXXXXXXXX',

  // 季節限定
  'seasonal_通常':          'price_XXXXXXXXXXXXXXXXXX',
};

const SITE_URL = 'https://www.dreamerscoffee.shop';

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': SITE_URL,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/create-checkout') {
      return handleCheckout(request, env, corsHeaders);
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function handleCheckout(request, env, corsHeaders) {
  try {
    const { items } = await request.json();

    if (!items || items.length === 0) {
      return jsonError('カートが空です', 400, corsHeaders);
    }

    // line_itemsのpriceIdを検証
    for (const item of items) {
      const priceId = PRICE_MAP[item.key];
      if (!priceId || priceId.startsWith('price_XXXX')) {
        return jsonError(
          `商品「${item.name}（${item.variant}）」の価格IDが設定されていません`,
          400, corsHeaders
        );
      }
    }

    // ★ ここが修正ポイント：URLSearchParamsではなくJSON形式でStripeに送る
    const sessionData = {
      mode: 'payment',
      success_url: `${SITE_URL}/order-complete.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/cart.html`,
      locale: 'ja',
      shipping_address_collection: {
        allowed_countries: ['JP']
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 600, currency: 'jpy' },
            display_name: '通常配送',
          }
        }
      ],
      line_items: items.map(item => ({
        price: PRICE_MAP[item.key],
        quantity: item.qty,
      }))
    };

    // Stripe APIはJSON未対応のため、フォーム形式に変換
    const body = objectToFormData(sessionData);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error('Stripe error:', JSON.stringify(session));
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

// ============================================================
// ネストしたオブジェクト・配列をStripeのフォーム形式に変換
// 例: line_items[0][price]=xxx&line_items[0][quantity]=1
// ============================================================
function objectToFormData(obj, prefix = '') {
  const params = new URLSearchParams();

  function encode(value, key) {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        encode(item, `${key}[${i}]`);
      });
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => {
        encode(v, `${key}[${k}]`);
      });
    } else {
      params.append(key, String(value));
    }
  }

  Object.entries(obj).forEach(([key, value]) => {
    encode(value, key);
  });

  return params.toString();
}

function jsonError(message, status, corsHeaders) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}
