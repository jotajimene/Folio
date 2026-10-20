// Herramientas libres empaquetadas para el navegador de la app (sin red).
import NSpell from 'nspell';
import createHyphenator from 'hyphen';
import patronesES from 'hyphen/patterns/es.js';
import bwipjs from 'bwip-js/browser';
import QRCode from 'qrcode';
globalThis.Herramientas = { NSpell, createHyphenator, patronesES, bwipjs, QRCode };
