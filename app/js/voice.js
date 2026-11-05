// The voice tutor screen. Minutes are tracked on the server; the countdown here only ends the call politely on time.
import { $, view, esc, api, ic } from "./util.js";
import { t, errText, voiceMinutes } from "./i18n.js";

let conv = null, timer = null;
async function hangUp() {
  clearInterval(timer);
  window.removeEventListener("hashchange", hangUp);
  const c = conv; conv = null;
  if (c) { try { await c.endSession(); } catch (e) { } }
}
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export async function viewVoice({ token, art, topbar, onOut }) {
  await hangUp();
  view().innerHTML = `<p class="empty">…</p>`;
  let st;
  try { st = await api("voice_status", { session: token }); }
  catch (e) {
    if (e.status === 401) return onOut();
    view().innerHTML = `${topbar}<div class="pc-center"><p class="pc-sub">${esc(errText(e.code))}</p></div>`;
    return;
  }
  const screen = inner => { view().innerHTML = `${topbar}<div class="pc-voice"><div class="pc-hero">${art}</div>${inner}</div>`; };
  const note = (title, sub) => screen(`<h1>${title}</h1><p class="pc-sub">${sub}</p>`);

  if (!st.enabled) return note(t("voiceOffTitle"), t("voiceOffSub"));
  if (st.remainingSeconds < 30) return screen(`<h1>${t("voiceCapTitle")}</h1><p class="pc-sub">${t("voiceCapSub")}</p><button class="btn block big" disabled>${t("voiceBuy")}</button>`);
  if (!st.configured) return note(t("voiceSoonTitle"), t("voiceSoonSub"));

  screen(`<h1>${t("voiceTitle")}</h1><p class="pc-sub">${t("voiceSub")}</p>
    <p class="pc-voice-left">${voiceMinutes(st.remainingSeconds)}</p>
    <button class="btn block big" id="vStart">${t("voiceStart")}</button>
    <p class="pc-sub small">${t("voiceLimit")}</p><p class="pc-err" id="vErr" role="alert"></p>`);
  const fail = code => { const e = $("#vErr"); if (e) e.textContent = code === "mic" ? t("voiceMic") : errText(code); const b = $("#vStart"); if (b) b.disabled = false; };

  $("#vStart").onclick = async () => {
    $("#vStart").disabled = true; // a second tap must not reserve a second call
    try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach(x => x.stop()); } // asked first, so a refused mic doesn't spend a reservation
    catch (e) { return fail("mic"); }
    let call;
    try { call = await api("voice_start", { session: token }); }
    catch (e) { if (e.code === "voice_cap") return viewVoice({ token, art, topbar, onOut }); return fail(e.code); }
    try {
      const { Conversation } = await import("../vendor/elevenlabs.mjs");
      let left = call.seconds, ended = false;
      const finish = () => {
        if (ended) return; ended = true;
        hangUp();
        if (location.hash.endsWith("/voice")) viewVoice({ token, art, topbar, onOut });
      };
      conv = await Conversation.startSession({
        signedUrl: call.signedUrl, connectionType: "websocket", dynamicVariables: { pc_call_id: call.callId },
        onDisconnect: finish, onError: () => finish(),
        onModeChange: ({ mode }) => { const m = $("#vMode"); if (m) m.textContent = t(mode === "speaking" ? "voiceSpeaking" : "voiceListening"); },
      });
      if (!location.hash.endsWith("/voice")) return hangUp(); // left the screen while connecting
      screen(`<h1 id="vMode">${t("voiceListening")}</h1><p class="pc-voice-left" id="vClock">${clock(left)}</p><button class="btn block big red" id="vEnd">${ic.x} ${t("voiceEnd")}</button>`);
      $("#vEnd").onclick = finish;
      window.addEventListener("hashchange", hangUp);
      timer = setInterval(() => {
        left--;
        const c = $("#vClock"); if (c) c.textContent = clock(Math.max(0, left));
        if (left <= 0) finish();
      }, 1000);
    } catch (e) { await hangUp(); fail("voice_failed"); }
  };
}
