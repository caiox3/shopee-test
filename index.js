const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
  res.json({ 
    message: 'Shopee Scraper API está funcionando!',
    endpoints: {
      scrape: '/api/scrape?url=URL_DO_PRODUTO',
      shopee: '/api/shopee?url=URL_SHOPEE',
      mercadolivre: '/api/mercadolivre?url=URL_ML'
    }
  });
});

// Rota principal de scraping
app.get('/api/scrape', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL é obrigatória' });
  }

  let browser;
  try {
    // Configuração do Puppeteer para Railway/Render
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set user agent para parecer um navegador real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Vai para a página
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Aguarda um pouco para carregar conteúdo dinâmico
    await page.waitForTimeout(3000);

    // Extrai dados da página
    const productData = await page.evaluate(() => {
      // Função para extrair dados genéricos
      const getMetaContent = (property) => {
        const meta = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
        return meta ? meta.getAttribute('content') : null;
      };

      // Tenta diferentes estratégias para encontrar o título
      let title = getMetaContent('og:title') || 
                  document.querySelector('h1')?.textContent?.trim() ||
                  document.title;

      // Tenta encontrar preço
      let price = getMetaContent('product:price:amount') ||
                  getMetaContent('og:price:amount') ||
                  document.querySelector('[class*="price"], [class*="Price"]')?.textContent?.trim();

      // Tenta encontrar imagem
      let image = getMetaContent('og:image') ||
                  document.querySelector('img[src*="product"], img[class*="product"]')?.src;

      // Tenta encontrar descrição
      let description = getMetaContent('og:description') ||
                        getMetaContent('description') ||
                        document.querySelector('p[class*="description"], div[class*="description"]')?.textContent?.trim();

      return {
        success: true,
        title: title || 'Título não encontrado',
        price: price || 'Preço não encontrado',
        image: image || null,
        description: description || 'Descrição não encontrada',
        url: window.location.href,
        source: 'web'
      };
    });

    await browser.close();
    res.json(productData);

  } catch (error) {
    console.error('Erro no scraping:', error);
    if (browser) await browser.close();
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Erro ao processar a URL. Tente novamente.' 
    });
  }
});

// Rota específica para Shopee
app.get('/api/shopee', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL é obrigatória' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(5000); // Shopee precisa de mais tempo

    const shopeeData = await page.evaluate(() => {
      // Shopee - selectors específicos
      const title = document.querySelector('.KL4AiJ, .WBVL_7, .VCNVHn, ._44qnta, h1')?.textContent?.trim();
      
      const price = document.querySelector('._3e_UQT, .pqTWkA, ._3c5u7X, ._2Shl1j')?.textContent?.trim();
      
      const image = document.querySelector('.qBOG5M img, .V2CF6t img, ._2GcUzQ img')?.src ||
                    document.querySelector('img[src*="shopee"]')?.src;
      
      const description = document.querySelector('.product-detail, ._2u0jt9, ._2aZyWI')?.textContent?.trim();

      return {
        success: true,
        title: title || document.title,
        price: price || 'Preço não disponível',
        image: image || null,
        description: description || 'Descrição do produto Shopee',
        url: window.location.href,
        source: 'shopee'
      };
    });

    await browser.close();
    res.json(shopeeData);

  } catch (error) {
    console.error('Erro Shopee:', error);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota específica para Mercado Livre
app.get('/api/mercadolivre', async (req, res) => {
  const { url } = req.query;
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);

    const mlData = await page.evaluate(() => {
      // Mercado Livre - selectors específicos
      const title = document.querySelector('.ui-pdp-title')?.textContent?.trim();
      
      const price = document.querySelector('.andes-money-amount__fraction')?.textContent?.trim();
      
      const image = document.querySelector('.ui-pdp-image__element')?.src ||
                    document.querySelector('.ui-pdp-gallery__figure__image')?.src;
      
      const description = document.querySelector('.ui-pdp-description__content')?.textContent?.trim();

      return {
        success: true,
        title: title || document.title,
        price: price ? `R$ ${price}` : 'Preço não disponível',
        image: image || null,
        description: description || 'Descrição do produto Mercado Livre',
        url: window.location.href,
        source: 'mercadolivre'
      };
    });

    await browser.close();
    res.json(mlData);

  } catch (error) {
    console.error('Erro Mercado Livre:', error);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: error.message });
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔗 Acesse: http://localhost:${PORT}`);
});
