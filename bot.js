const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createCursor } = require('ghost-cursor');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

puppeteer.use(StealthPlugin());
const app = express();
app.use(cors());
app.use(express.json());

const SITE_URL = 'https://getflix-phi.vercel.app/';

const PROXY_API_URL = 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&country=af%2Cal%2Cdz%2Cad%2Cao%2Car%2Cam%2Cau%2Cat%2Caz%2Cbd%2Cby%2Cbe%2Cbj%2Cbm%2Cbt%2Cbo%2Cbw%2Cbg%2Cbf%2Cbi%2Ckh%2Ccm%2Cca%2Ctd%2Ccl%2Ccn%2Cco%2Ccg%2Ccr%2Chr%2Ccy%2Ccz%2Cdk%2Cdo%2Cec%2Ceg%2Csv%2Cgq%2Cee%2Csz%2Cet%2Cfj%2Cfi%2Cfr%2Cgm%2Cge%2Cde%2Cgh%2Cgi%2Cgr%2Cgu%2Cgt%2Cgn%2Cht%2Chn%2Chk%2Chu%2Cin%2Cid%2Cir%2Ciq%2Cie%2Cil%2Cit%2Cjm%2Cjp%2Cjo%2Ckz%2Cke%2Ckr%2Ckg%2Clv%2Clb%2Cls%2Clt%2Cmg%2Cmw%2Cmy%2Cmv%2Cml%2Cmt%2Cmu%2Cmx%2Cmd%2Cmn%2Cme%2Cma%2Cmz%2Cmm%2Cna%2Cnp%2Cnl%2Cnz%2Cni%2Cng%2Cmk%2Cno%2Cpk%2Cps%2Cpa%2Cpy%2Cpe%2Cph%2Cpl%2Cpt%2Cpr%2Cqa%2Cro%2Crw%2Ckn%2Csa%2Csn%2Crs%2Csc%2Csl%2Csg%2Csk%2Csi%2Cso%2Cza%2Ces%2Clk%2Csd%2Cse%2Cch%2Csy%2Ctw%2Ctj%2Ctz%2Cth%2Ctl%2Ctg%2Ctn%2Ctr%2Cug%2Cua%2Cae%2Cgb%2Cus%2Cuy%2Cuz%2Cve%2Cvn%2Cvi%2Cye%2Czw';

const randomDelay = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

let isProcessing = false;
let lastExecutions = [];
const MAX_CALLS_PER_30S = 2;
let workingProxies = [];

// 1. Buscar Proxies da API (CÓDIGO CORRIGIDO)
async function fetchProxies() {
    try {
        console.log('Buscando lista de proxies...');
        const response = await fetch(PROXY_API_URL);
        const text = await response.text();
        
        // A API já retorna no formato "http://152.53.20.190:20000"
        // Apenas filtramos as linhas que começam com http ou https
        const proxies = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('http://') || line.startsWith('https://'));
            
        console.log(`✅ ${proxies.length} proxies HTTP encontrados.`);
        return proxies;
    } catch (error) {
        console.error('Erro ao buscar proxies:', error.message);
        return [];
    }
}

// 2. Validação rápida de Proxy com Axios
async function proxyEstaVivo(proxyUrl, testUrl = SITE_URL, timeout = 5000) {
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

// 3. Função Principal do Bot
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

    const maxRetries = 5; 
    
    for (let i = 0; i < maxRetries; i++) {
        const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
        console.log(`\n[${new Date().toLocaleTimeString()}] Tentativa ${i + 1}: Validando proxy ${proxy}...`);
        
        const vivo = await proxyEstaVivo(proxy);
        if (!vivo) {
            console.log(`⏳ Proxy morto. Pulando...`);
            workingProxies = workingProxies.filter(p => p !== proxy);
            continue;
        }

        console.log(`✅ Proxy validado! Abrindo navegador...`);
        
        let browser;
        let page;
        
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                // Caminho do Chrome instalado pelo Dockerfile
                executablePath: '/usr/bin/google-chrome-stable',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', `--proxy-server=${proxy}`]
            });

            page = await browser.newPage();
            
            // ⏱️ TIMEOUT GLOBAL: 15 segundos para QUALQUER espera (goto, click, waitForSelector)
            page.setDefaultTimeout(15000);
            
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1366, height: 768 });
            const cursor = createCursor(page);

            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            browser.on('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    const adPage = await target.page();
                    if (adPage) {
                        try {
                            await randomDelay(2000, 4000);
                            await adPage.close();
                            await page.bringToFront();
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

            console.log('✅ Site carregado. Iniciando comportamento humano...');
            await cursor.move({ x: 600, y: 400 });
            await randomDelay(1000, 2000);
            
            if (Math.random() < 0.3) {
                console.log('⌨️ Abrindo busca e digitando...');
                await cursor.click('#searchToggle');
                await randomDelay(500, 1000);
                const termos = ['Batman', 'Interestelar', 'Série', 'Anime', 'Terror'];
                const termo = termos[Math.floor(Math.random() * termos.length)];
                await page.type('#searchInput', termo, { delay: 100 });
                await randomDelay(2000, 4000);
                await page.click('#searchClose');
                await randomDelay(500, 1000);
            }

            await page.evaluate(() => window.scrollBy(0, 600));
            await randomDelay(1000, 3000);

            if (Math.random() < 0.4) {
                const banners = await page.$$('.ad-mobile, .ad-native');
                if (banners.length > 0) {
                    const banner = banners[Math.floor(Math.random() * banners.length)];
                    const currentUrl = page.url();
                    await cursor.move(banner);
                    await randomDelay(500, 1200);
                    await cursor.click(banner);
                    await randomDelay(2000, 4000); 
                    if (page.url() !== currentUrl) {
                        await page.goBack({ waitUntil: 'domcontentloaded' });
                        await randomDelay(1000, 2000);
                    }
                }
            }

            const filmes = await page.$$('#main-content .mc');
            if (filmes.length > 0) {
                const filmeAleatorio = filmes[Math.floor(Math.random() * filmes.length)];
                await cursor.move(filmeAleatorio);
                await randomDelay(800, 1500);
                await cursor.click(filmeAleatorio);
                await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
            }

            await page.waitForSelector('#mainPlayer');
            await randomDelay(2000, 4000);
            
            if (Math.random() < 0.3) {
                const playerBanners = await page.$$('.ad-mobile, .ad-sidebar');
                if (playerBanners.length > 0) {
                    const pBanner = playerBanners[Math.floor(Math.random() * playerBanners.length)];
                    await cursor.move(pBanner);
                    await randomDelay(500, 1000);
                    await cursor.click(pBanner);
                    await randomDelay(2000, 3000);
                }
            }

            await page.evaluate(() => {
                const recs = document.getElementById('recsSection');
                if (recs) recs.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            await randomDelay(2000, 4000);

            const recs = await page.$$('#recsGrid .mc');
            if (recs.length > 0) {
                const recAleatoria = recs[Math.floor(Math.random() * recs.length)];
                await cursor.move(recAleatoria);
                await randomDelay(500, 1500);
                await cursor.click(recAleatoria);
                await randomDelay(3000, 8000);
            }

            console.log('🎉 Engajamento concluído com sucesso!');
            break; 
            
        } catch (error) {
            console.warn(`⚠️ Erro ou timeout estourado: ${error.message}`);
            workingProxies = workingProxies.filter(p => p !== proxy);
        } finally {
            try { if (page) await page.close(); } catch (e) {}
            try { if (browser) await browser.close(); } catch (e) {}
        }
    }
    console.log('Ciclo do bot finalizado.');
}

// --- GESTÃO DA FILA E RATE LIMIT ---
async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (true) {
        const now = Date.now();
        lastExecutions = lastExecutions.filter(time => now - time < 30000);

        if (lastExecutions.length < MAX_CALLS_PER_30S) {
            lastExecutions.push(now);
            await executarSequenciaGetflix();
        } else {
            const tempoParaEsperar = 30000 - (now - lastExecutions[0]) + 1000;
            console.log(`⏳ Limite de taxa. Aguardando ${Math.round(tempoParaEsperar/1000)}s...`);
            await new Promise(r => setTimeout(r, tempoParaEsperar));
        }
    }
}

// --- ENDPOINTS DA API ---

// Endpoint de Saúde (Monitoramento)
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        uptime_seconds: Math.round(process.uptime()),
        working_proxies_count: workingProxies.length,
        is_processing: isProcessing
    });
});

// Endpoint do Bot
app.post('/api/engajar', async (req, res) => {
    res.status(202).json({ status: 'queued', message: 'Bot na fila.' });
    if (!isProcessing) {
        processQueue();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor de Bot rodando na porta ${PORT}`));
