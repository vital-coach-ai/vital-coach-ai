const https = require('https');

function stripeGet(path, secretKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stripe.com',
      path,
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe key not configured' }) };
  }

  const { email } = JSON.parse(event.body || '{}');
  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No email provided' }) };
  }

  try {
    const customers = await stripeGet(
      `/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
      STRIPE_SECRET_KEY
    );

    if (!customers.data || customers.data.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      };
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripeGet(
      `/v1/subscriptions?customer=${customerId}&status=active&limit=1`,
      STRIPE_SECRET_KEY
    );

    const active = !!(subscriptions.data && subscriptions.data.length > 0);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
