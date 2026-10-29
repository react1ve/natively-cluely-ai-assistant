// RU translations for the transcription and audio notices the meeting overlay
// (src/components/NativelyInterface.tsx) and the notes window
// (src/components/NotesWindow.tsx) show. Spread in i18n.tsx before the
// hand-authored entries; keys are the exact English strings passed to t().
// src/lib/__tests__/transcriptionNoticesRu2026_10_29.test.mjs covers them.
export const TRANSCRIPTION_RU: Record<string, string> = {
    // ── Overlay banner ──
    "Transcription Stopped": "Транскрипция остановлена",
    "Nothing is being transcribed right now. Check your transcription provider and its key in Settings.": "Сейчас ничего не транскрибируется. Проверьте провайдера транскрипции и его ключ в Настройках.",
    "Your microphone is no longer being transcribed. Check your transcription provider and its key in Settings.": "Ваш микрофон больше не транскрибируется. Проверьте провайдера транскрипции и его ключ в Настройках.",
    "Interviewer audio is no longer being transcribed. Check your transcription provider and its key in Settings.": "Звук собеседника больше не транскрибируется. Проверьте провайдера транскрипции и его ключ в Настройках.",
    "Apple Speech does not support this language. Pick a supported language in Settings › Audio, or another provider such as Local Models.": "Apple Speech не поддерживает этот язык. Выберите поддерживаемый язык в Настройках › Звук или другой провайдер, например локальные модели.",
    "Transcription Reconnecting": "Транскрипция переподключается",
    "The connection to your speech-to-text provider dropped. Retrying.": "Соединение с провайдером распознавания речи прервалось. Повторяем попытку.",
    "Transcribing on a backup provider": "Транскрипция через резервного провайдера",

    // ── Notes window status line ──
    "Transcription stopped. Check your speech provider in Settings.": "Транскрипция остановлена. Проверьте провайдера распознавания речи в Настройках.",
    "Transcription is reconnecting…": "Транскрипция переподключается…",
    "Natively can’t hear your microphone. Check Settings › Audio.": "Natively не слышит ваш микрофон. Проверьте Настройки › Звук.",
    "Natively can’t hear the call. Check Settings › Audio.": "Natively не слышит звонок. Проверьте Настройки › Звук.",
    "Audio is off because Ambient AI Chat is on. Turn it off in Settings › General.": "Звук выключен, потому что включён Ambient AI Chat. Отключите его в Настройках › Основные.",
};
