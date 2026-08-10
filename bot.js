const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

puppeteer.use(StealthPlugin());
const app = express();
app.use(cors());
app.use(express.json());

const SITE_URL = 'https://getflix-phi.vercel.app/';

// FONTES DE PROXIES (Adicionada a nova API do Roundproxies)
const PROXY_API_URLS = [
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
    'https://www.proxy-list.download/api/v1/get?type=http',
    'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/generated/http_proxies.txt',
    'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
    // NOVA FONTE: Roundproxies (Filtro de proxies mais rápidos)
    'https://roundproxies.com/api/get-free-proxies?limit=100&page=1&sort_by=lastChecked&sort_type=desc&speed=fast'
];

const randomDelay = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

let isProcessing = false;
let workingProxies = [];

// 1. Buscar Proxies
async function fetchProxies() {
    const allProxies = new Set();
    for (const url of PROXY_API_URLS) {
        try {
            const shortName = url.split('/').slice(-1)[0].substring(0, 25);
            console.log(`Buscando de: ${shortName}...`);
            const response = await fetch(url);
            const text = await response.text();
            const ipPortRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}\b/g;
            const matches = text.match(ipPortRegex);
            if (matches && matches.length > 0) {
                matches.forEach(p => allProxies.add(p));
                console.log(`✅ ${matches.length} proxies desta fonte.`);
            } else {
                console.log(`⚠️ Nenhum proxy válido encontrado nesta fonte.`);
            }
        } catch (error) {
            console.warn(`⚠️ Erro ao buscar de ${url}: ${error.message}`);
        }
    }
    const result = Array.from(allProxies).map(p => `http://${p}`);
    console.log(`✅ Total único: ${result.length} proxies HTTP prontos para uso.`);
    return result;
}

// 2. Validação rápida
async function proxyEstaVivo(proxyUrl, testUrl = SITE_URL, timeout = 3000) {
    try {
        const agent = new HttpsProxyAgent(proxyUrl);
        await axios.get(testUrl, {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: timeout,
            maxRedirects: 0,
            validateStatus: () => true
        });
        return true;
    } catch (error) {
        return false;
    }
}

// 3. Função Principal
async function executarSequenciaGetflix() {
    let proxyList = [];
    if (workingProxies.length > 0) {
        console.log(`♻️ Tentando ${workingProxies.length} proxies salvos...`);
        proxyList = [...workingProxies];
    }
    
    const freshProxies = await fetchProxies();
    freshProxies.forEach(p => { if (!proxyList.includes(p)) proxyList.push(p); });

    if (proxyList.length === 0) {
        console.error('Nenhum proxy disponível. Abortando.');
        return;
    }

    const maxRetries = 10; 
    
    for (let i = 0; i < maxRetries; i++) {
        const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
        console.log(`\n[${new Date().toLocaleTimeString()}] Tentativa ${i + 1}: Validando proxy ${proxy}...`);
        
        const vivo = await proxyEstaVivo(proxy);
        if (!vivo) {
            console.log(`⏳ Proxy morto/lento. Pulando...`);
            workingProxies = workingProxies.filter(p => p !== proxy);
            continue;
        }

        console.log(`✅ Proxy validado! Abrindo navegador...`);
        
        let browser;
        let page;
        
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                executablePath: '/usr/bin/google-chrome-stable',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', `--proxy-server=${proxy}`]
            });

            page = await browser.newPage();
            page.setDefaultTimeout(60000); // 60s de tolerância
            
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1366, height: 768 });

            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            // MONITOR DE MONETIZAÇÃO
            browser.on('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    const adPage = await target.page();
                    if (adPage) {
                        try {
                            console.log('💰 [Monetização] Smartlink/Anúncio abriu! Contando impressão...');
                            await randomDelay(2000, 4000);
                            await adPage.close();
                            await page.bringToFront();
                            console.log('🔒 Anúncio fechado. Voltando ao GETFLIX.');
                        } catch (e) {}
                    }
                }
            });

            console.log('Acessando o GETFLIX...');
            await page.goto(SITE_URL, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('#main-content .mc');
            
            if (!workingProxies.includes(proxy)) {
                workingProxies.push(proxy);
                if (workingProxies.length > 20) workingProxies.shift();
            }

            // FUNÇÕES AUXILIARES BLINDADAS
            const pegarCentroDoSeletor = async (seletor) => {
                return await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return null;
                    const rect = el.getBoundingClientRect();
                    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                }, seletor);
            };

            const pegarCentroDeVarios = async (seletor) => {
                return await page.evaluate((sel) => {
                    const els = Array.from(document.querySelectorAll(sel));
                    return els.map(el => {
                        const rect = el.getBoundingClientRect();
                        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                    }).filter(b => b.x > 0 && b.y > 0);
                }, seletor);
            };

            const moverMouseRealista = async (x, y) => {
                const steps = 10;
                for (let i = 1; i <= steps; i++) {
                    await page.mouse.move((x / steps) * i + Math.random() * 5, (y / steps) * i + Math.random() * 5);
                    await new Promise(r => setTimeout(r, 10));
                }
            };

            const clicarNasCoordenadas = async (coords) => {
                if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number') return;
                try {
                    await moverMouseRealista(coords.x, coords.y);
                    await randomDelay(100, 300);
                    await page.mouse.click(coords.x, coords.y);
                } catch (e) {
                    console.warn('Falha ao clicar:', e.message);
                }
            };

            console.log('✅ Site carregado. Iniciando comportamento humano...');
            await moverMouseRealista(600, 400);
            await randomDelay(1000, 2000);
            
            // BLOCO 1: BUSCA
            try {
                if (Math.random() < 0.3) {
                    console.log('⌨️ Abrindo busca e digitando...');
                    const searchBtn = await pegarCentroDoSeletor('#searchToggle');
                    await clicarNasCoordenadas(searchBtn);
                    await randomDelay(500, 1000);
                    const termos = ['Batman', 'Interestelar', 'Série', 'Anime', 'Terror'];
                    const termo = termos[Math.floor(Math.random() * termos.length)];
                    await page.type('#searchInput', termo, { delay: 100 });
                    await randomDelay(2000, 4000);
                    const closeBtn = await pegarCentroDoSeletor('#searchClose');
                    await clicarNasCoordenadas(closeBtn);
                    await randomDelay(500, 1000);
                }
            } catch (e) { console.warn('Erro na busca:', e.message); }

            await page.evaluate(() => window.scrollBy(0, 600));
            await randomDelay(1000, 3000);

            // BLOCO 2: BANNERS
            try {
                if (Math.random() < 0.4) {
                    const bannerCoords = await pegarCentroDeVarios('.ad-mobile, .ad-native');
                    if (bannerCoords.length > 0) {
                        const target = bannerCoords[Math.floor(Math.random() * bannerCoords.length)];
                        const currentUrl = page.url();
                        await clicarNasCoordenadas(target);
                        await randomDelay(2000, 4000); 
                        if (page.url() !== currentUrl) {
                            await page.goBack({ waitUntil: 'domcontentloaded' });
                            await randomDelay(1000, 2000);
                        }
                    }
                }
            } catch (e) { console.warn('Erro no banner:', e.message); }

            // BLOCO 3: FILME
            try {
                const filmeCoords = await pegarCentroDeVarios('#main-content .mc');
                if (filmeCoords.length > 0) {
                    const target = filmeCoords[Math.floor(Math.random() * filmeCoords.length)];
                    await clicarNasCoordenadas(target);
                    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
                }
            } catch (e) { console.warn('Erro ao clicar no filme:', e.message); }

            // BLOCO 4: PLAYER
            try {
                await page.waitForSelector('#mainPlayer');
                await randomDelay(2000, 4000);
                
                if (Math.random() < 0.3) {
                    const playerBanners = await pegarCentroDeVarios('.ad-mobile, .ad-sidebar');
                    if (playerBanners.length > 0) {
                        const target = playerBanners[Math.floor(Math.random() * playerBanners.length)];
                        await clicarNasCoordenadas(target);
                        await randomDelay(2000, 3000);
                    }
                }
            } catch (e) { console.warn('Erro no player:', e.message); }

            // BLOCO 5: RECOMENDAÇÕES
            try {
                await page.evaluate(() => {
                    const recs = document.getElementById('recsSection');
                    if (recs) recs.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                await randomDelay(2000, 4000);

                const recsCoords = await pegarCentroDeVarios('#recsGrid .mc');
                if (recsCoords.length > 0) {
                    const target = recsCoords[Math.floor(Math.random() * recsCoords.length)];
                    await clicarNasCoordenadas(target);
                    await randomDelay(3000, 8000);
                }
            } catch (e) { console.warn('Erro nas recomendações:', e.message); }

            console.log('🎉 Engajamento concluído com sucesso!');
            break; 
            
        } catch (error) {
            console.warn(`⚠️ Erro fatal ou timeout estourado: ${error.message}`);
            workingProxies = workingProxies.filter(p => p !== proxy);
        } finally {
            try { if (page) await page.close(); } catch (e) {}
            try { if (browser) await browser.close(); } catch (e) {}
        }
    }
    console.log('Ciclo do bot finalizado.');
}

// --- LÓGICA DE LOOP (Sem limite rígido, com pausa humana) ---
async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (true) {
        await executarSequenciaGetflix();
        
        // Pausa humana: Descansa de 2 a 5 minutos (120s a 300s) antes do próximo acesso
        const tempoDescanso = Math.floor(Math.random() * (300 - 120 + 1) + 120);
        console.log(`\n😴 Ciclo concluído. Bot vai descansar por ${tempoDescanso} segundos para simular comportamento humano...`);
        await new Promise(r => setTimeout(r, tempoDescanso * 1000));
    }
}

// --- ENDPOINTS DA API ---
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        uptime_seconds: Math.round(process.uptime()),
        working_proxies_count: workingProxies.length,
        is_processing: isProcessing
    });
});

app.post('/api/engajar', async (req, res) => {
    res.status(202).json({ status: 'queued', message: 'Bot na fila.' });
    if (!isProcessing) {
        processQueue();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor de Bot rodando na porta ${PORT}`));
