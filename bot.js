const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// 🛡️ BLINDAGEM GLOBAL: Impede que erros do plugin Stealth derrubem o servidor
process.on('unhandledRejection', (reason, promise) => {
    console.warn('⚠️ Erro interno ignorado (Stealth plugin/aba fechada):', reason.message || reason);
});

puppeteer.use(StealthPlugin());
const app = express();
app.use(cors());
app.use(express.json());

const SITE_URL = 'https://getflix-phi.vercel.app/';

// ✅ CONFIGURAÇÃO DOS 10 IPs PREMIUM DO DECODO (EUA)
const PROXY_USER = 'sptaffskwx';
const PROXY_PASS = '4jvbUhClYsP0m_4bv1';
const DECODO_PROXIES = [
    { host: 'dc.decodo.com', port: 10001 },
    { host: 'dc.decodo.com', port: 10002 },
    { host: 'dc.decodo.com', port: 10003 },
    { host: 'dc.decodo.com', port: 10004 },
    { host: 'dc.decodo.com', port: 10005 },
    { host: 'dc.decodo.com', port: 10006 },
    { host: 'dc.decodo.com', port: 10007 },
    { host: 'dc.decodo.com', port: 10008 },
    { host: 'dc.decodo.com', port: 10009 },
    { host: 'dc.decodo.com', port: 10010 }
];

const randomDelay = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

let isProcessing = false;

// 1. Validação com httpbin.org
async function proxyEstaVivo(proxyUrl, timeout = 10000) {
    try {
        const agent = new HttpsProxyAgent(proxyUrl);
        await axios.get('http://httpbin.org/ip', {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: timeout,
            validateStatus: () => true
        });
        return true;
    } catch (error) {
        return false;
    }
}

// 2. Função Principal
async function executarSequenciaGetflix() {
    const maxRetries = 10; 
    
    for (let i = 0; i < maxRetries; i++) {
        // Sorteia um dos 10 IPs do Decodo
        const selectedProxy = DECODO_PROXIES[Math.floor(Math.random() * DECODO_PROXIES.length)];
        
        // URL para o Axios testar
        const proxyUrlFull = `http://${PROXY_USER}:${PROXY_PASS}@${selectedProxy.host}:${selectedProxy.port}`;
        
        // URL para o Chrome (sem usuário e senha)
        const proxyUrlChrome = `http://${selectedProxy.host}:${selectedProxy.port}`;
        
        // Credenciais separadas para o Puppeteer
        const authCredentials = {
            username: PROXY_USER,
            password: PROXY_PASS
        };

        console.log(`\n[${new Date().toLocaleTimeString()}] Tentativa ${i + 1}: Validando Decodo IP (${selectedProxy.host}:${selectedProxy.port})...`);
        
        const vivo = await proxyEstaVivo(proxyUrlFull);
        if (!vivo) {
            console.log(`⏳ Proxy demorou a conectar. Tentando outro...`);
            await randomDelay(2, 4);
            continue;
        }

        console.log(`✅ Proxy validado! Abrindo navegador...`);
        
        let browser;
        let page;
        
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                executablePath: '/usr/bin/google-chrome-stable',
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage',
                    '--ignore-certificate-errors',
                    `--proxy-server=${proxyUrlChrome}`
                ]
            });

            page = await browser.newPage();
            
            // FAZ A AUTENTICAÇÃO DO PROXY DENTRO DO NAVEGADOR
            await page.authenticate(authCredentials);
            
            page.setDefaultTimeout(45000); 
            
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'font', 'media'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1366, height: 768 });

            await page.setExtraHTTPHeaders({
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"'
            });

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
                            console.log('💰 [Monetização] Anúncio abriu! Contando impressão...');
                            await randomDelay(10000, 15000); // Deixa aberto para contar
                            await adPage.close();
                            await page.bringToFront();
                            console.log('🔒 Anúncio fechado.');
                        } catch (e) {}
                    }
                }
            });

            console.log('Acessando o GETFLIX...');
            await page.goto(SITE_URL, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('#main-content .mc');

            // FUNÇÕES AUXILIARES
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
                    const termos = ['Batman','Anime', 'Terror'];
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
                    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
                }
            } catch (e) { console.warn('Erro ao clicar no filme:', e.message); }

            // BLOCO 4: PLAYER
            try {
                await page.waitForSelector('#mainPlayer', { timeout: 30000 });
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
        } finally {
            try { if (page) await page.close(); } catch (e) {}
            try { if (browser) await browser.close(); } catch (e) {}
        }
    }
    console.log('Ciclo do bot finalizado.');
}

// --- LÓGICA DE LOOP (Pausa humana longa para proteger os 10 IPs) ---
async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (true) {
        await executarSequenciaGetflix();
        
        // Pausa humana: Descansa de 3 a 6 minutos (180s a 360s) para proteger os 10 IPs
        const tempoDescanso = Math.floor(Math.random() * (360 - 180 + 1) + 180);
        console.log(`\n😴 Ciclo concluído. Bot vai descansar por ${tempoDescanso} segundos para proteger os IPs...`);
        await new Promise(r => setTimeout(r, tempoDescanso * 1000));
    }
}

// --- ENDPOINTS DA API ---
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        uptime_seconds: Math.round(process.uptime()),
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
