// POST /api/create-perfil-payment
// Recibe los datos del test del frontend y crea una preferencia de Mercado Pago.
import { MercadoPagoConfig, Preference } from 'mercadopago';
import crypto from 'crypto';
import { PROFILES, PRICE_ARS } from '../lib/profiles.js';

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, profile_key, profile_name, scores, reaction_value, reaction_avg_seconds } = req.body || {};

    if (!name || !email || !profile_key || !scores) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    if (!PROFILES[profile_key]) {
      return res.status(400).json({ error: 'Perfil inválido' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const reportId = crypto.randomBytes(12).toString('hex');
    const baseUrl = process.env.APP_BASE_URL || 'https://fmagestionhumana.com.ar';

    const preference = new Preference(mp);
    const pref = await preference.create({
      body: {
        items: [{
          id: `informe-perfil-${profile_key}`,
          title: `Informe Premium · ${profile_name}`,
          description: `Informe personalizado del perfil laboral "${profile_name}" generado con IA`,
          quantity: 1,
          unit_price: PRICE_ARS,
          currency_id: 'ARS'
        }],
        payer: {
          name: name.split(' ')[0] || name,
          surname: name.split(' ').slice(1).join(' ') || '',
          email
        },
        back_urls: {
          success: `${baseUrl}/mi-perfil-laboral?status=approved`,
          pending: `${baseUrl}/mi-perfil-laboral?status=pending`,
          failure: `${baseUrl}/mi-perfil-laboral?status=failure`
        },
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/mercadopago-webhook-perfil`,
        external_reference: reportId,
        metadata: {
          report_id: reportId,
          name,
          email,
          profile_key,
          profile_name,
          foco: scores.foco,
          ritmo: scores.ritmo,
          estructura: scores.estructura,
          comunicacion: scores.comunicacion,
          reaction_value,
          reaction_avg_seconds
        }
      }
    });

    return res.status(200).json({
      init_point: pref.init_point,
      report_id: reportId
    });
  } catch (err) {
    console.error('Error en create-perfil-payment:', err);
    return res.status(500).json({ error: 'No se pudo crear el pago: ' + err.message });
  }
}
