import fetch from 'node-fetch';

async function test() {
  const urls = [
    'https://image.pollinations.ai/prompt/test',
    'https://pollinations.ai/p/test',
    'https://pollinations.ai/prompt/test'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      console.log(`${url}: ${res.status} ${res.headers.get('content-type')}`);
    } catch (e) {
      console.log(`${url}: Error ${e.message}`);
    }
  }
}

test();
