import React, { useEffect, useState } from 'react';
import {
    ArrowRight, AudioLines, CalendarCheck, Code, Crop, Eye, FileText, FlaskConical, Ghost, Info, Keyboard, LayoutGrid,
    ListOrdered, MessageSquareText, MonitorUp, MousePointerClick, Move, PanelTop, PointerOff, ShieldCheck, Smartphone,
    TriangleAlert,
} from 'lucide-react';
import { AutoAnswerIcon } from '../AutoAnswerIcon';
import { ProfileIntelligenceIcon } from '../ProfileIntelligenceIcon';
import { useT } from '../../i18n';
import { useShortcuts, type ShortcutConfig } from '../../hooks/useShortcuts';
import { isMac, isWindows } from '../../utils/platformUtils';
import { useResolvedTheme } from '../../hooks/useResolvedTheme';
import { LiquidGlassBadge } from '../../ui-components/LiquidGlassBadge';
import { LiquidGlassButton } from '../../ui-components/LiquidGlassButton';
import {
    Presence, SETTINGS_BTN, SettingsFootnote, SettingsMotionReady, SettingsNotice, SettingsRow,
    SettingsSectionHeading, useMotionReadyAfter, useSettingsTones,
} from './SettingsRow';
// The learn-more hover (.t-learn) the Go buttons use, shared with Plans and About.
import './HowItWorksRefund.css';
import {
    HelpClip, HelpCommand, HelpDefinitions, HelpFigure, HelpGuideRow, HelpKeys, HelpLegend, HelpLink,
    HelpPath, HelpSteps, HelpSubhead, helpFill,
} from './help/HelpParts';
import { AnswerFlowFigure, NativelyGlyph, OverlayAnatomyFigure, PermissionsFigure } from './help/HelpGraphics';
import { HELP_CLIPS, PERMISSIONS_CARD, type HelpClipEntry } from './help/helpClips';
import {
    getPermissions, getPlatformFacts, getRowCopy, isHelpPlatform,
    type HelpPermission, type HelpPlatform,
} from '../../lib/helpContent.mjs';
import {
    contextUnlocked, modeStep, modelStep, nativelyStep, permissionsStep, profileStep, speechStep, type SetupStep,
} from '../../lib/helpSetupStatus.mjs';
import zoomCaptureModeScreenshot from '../../assets/zoom-capture-mode.png';

// Settings → Setup & Help.
//
// Built from `./SettingsRow`, the module General, Audio, Companion, Intelligence and
// About are built from, so this pane reads as part of Settings: a section is an
// 18px heading over one short line, and everything under it is the same row —
// [40px tile][14px/700 title][12px description][control].
//
// Show, don't tell. A guide opens on a screen recording of the real app with its
// steps underneath (HelpClip); the steps are the guide's text, and pressing one
// jumps the recording there. What stays in prose is what a recording can't
// show: a warning, a fact that differs by platform, a command to copy.
//
// Get started reads this install (helpSetupStatus.mjs) and says what is already
// done, as facts — "Microphone and Screen Recording allowed" — never "working".
//
// Nothing here restates a fact the app owns. Keys come from the user's own
// bindings (useShortcuts). Platform differences, including which recordings a
// platform may be shown, come from src/lib/helpContent.mjs, where the macOS
// and Windows branches are both tested. The copy names UI labels, not model
// ids, counts, durations or prices.

const CHROME_WEB_STORE_URL = 'https://chromewebstore.google.com/detail/lmhgnkbjnelmciecjkleaomjpejcgaln?utm_source=item-share-cb';
const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';
// The model AI Providers' own Ollama empty state suggests (AIProvidersSettings).
const OLLAMA_STARTER_COMMAND = 'ollama pull qwen2.5:3b';

// Rows separate by rhythm, not rules — General's container, verbatim (see About).
const ROW_GROUP = 'rounded-xl border bg-transparent border-transparent';

/** A navigation button in a row's control rail: "Audio →". The arrow leans 2px
    toward where it goes on hover (.t-learn, HowItWorksRefund.css), as About's do. */
const GoButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <button type="button" onClick={onClick} className={`t-learn ${SETTINGS_BTN}`}>
        {label}
        <span className="t-learn-chevron" aria-hidden="true"><ArrowRight size={13} /></span>
    </button>
);

/** Opens the OS page for one permission. */
function openPermission(permission: HelpPermission) {
    if (permission.open.kind === 'url') {
        window.electronAPI?.openExternal?.(permission.open.url);
    } else {
        void window.electronAPI?.openMicSettings?.();
    }
}

/** The four "Move Window" bindings as one row of keys when they share modifiers. */
function moveKeys(shortcuts: ShortcutConfig): string[] {
    const all = [shortcuts.moveWindowUp, shortcuts.moveWindowDown, shortcuts.moveWindowLeft, shortcuts.moveWindowRight];
    if (all.some((keys) => !keys || keys.length === 0)) return shortcuts.moveWindowUp ?? [];
    const prefix = all[0].slice(0, -1);
    const shared = all.every((keys) => keys.length === prefix.length + 1 && keys.slice(0, -1).join('+') === prefix.join('+'));
    return shared ? [...prefix, 'Arrows'] : shortcuts.moveWindowUp;
}

function currentHelpPlatform(): string {
    if (isMac) return 'darwin';
    if (isWindows) return 'win32';
    return 'unsupported';
}

// ── Live setup status ───────────────────────────────────────────────────────

type PermissionCheck = { platform?: string; microphone?: string; screen?: string };

interface SetupStatus {
    natively: SetupStep;
    /** null when the OS check itself failed: the row then says where the setting is. */
    permissions: SetupStep | null;
    speech: SetupStep;
    model: SetupStep;
    mode: SetupStep;
    profile: SetupStep;
    /** Every first read has landed (the permission check may also have failed). */
    loaded: boolean;
}

type ActiveMode = { name?: string; templateType?: string } | null;

/**
 * What Get started reports: the OS permission check the launcher's permissions
 * card uses, the saved credentials, and the active model. Re-read when
 * credentials or the model change, and when the window regains focus — which
 * is when someone comes back from System Settings or Windows Settings.
 */
function useSetupStatus(platform: HelpPlatform): SetupStatus {
    const [check, setCheck] = useState<PermissionCheck | null>(null);
    const [checkFailed, setCheckFailed] = useState(false);
    const [creds, setCreds] = useState<Record<string, unknown> | null>(null);
    const [llm, setLlm] = useState<{ provider?: string; modelId?: string } | null>(null);
    const [license, setLicense] = useState<{ isPremium?: boolean } | null>(null);
    const [trial, setTrial] = useState<{ hasToken?: boolean; expired?: boolean } | null>(null);
    // undefined = still reading; null = read, and nothing is set.
    const [activeMode, setActiveMode] = useState<ActiveMode | undefined>(undefined);
    const [profile, setProfile] = useState<{ hasProfile?: boolean } | null | undefined>(undefined);

    useEffect(() => {
        const api = window.electronAPI;
        let alive = true;
        const readPermissions = () => {
            // On macOS this can take a few seconds: a Screen Recording status
            // other than 'granted' is confirmed with a capture probe. The
            // launcher runs the same check every time it opens, so this asks
            // the OS nothing new.
            api?.checkPermissions?.()
                .then((r) => { if (alive) { setCheck(r); setCheckFailed(false); } })
                .catch(() => { if (alive) setCheckFailed(true); });
        };
        const readCredentials = () => {
            api?.getStoredCredentials?.()
                .then((c) => { if (alive) setCreds(c as unknown as Record<string, unknown>); })
                .catch(() => {});
            api?.getCurrentLlmConfig?.()
                .then((l) => { if (alive) setLlm(l); })
                .catch(() => {});
        };
        // Modes and Profile Intelligence: whether the plan opens them (Pro or a
        // live trial, App.tsx's rule), and what is set in each. A failed read
        // settles as "nothing set" rather than leaving the row on Checking.
        const readContext = () => {
            api?.licenseGetDetails?.()
                .then((d) => { if (alive) setLicense({ isPremium: !!d?.isPremium }); })
                .catch(() => { if (alive) setLicense({ isPremium: false }); });
            (api?.getLocalTrial?.() ?? Promise.resolve({ hasToken: false }))
                .then((tr) => { if (alive) setTrial(tr ?? { hasToken: false }); })
                .catch(() => { if (alive) setTrial({ hasToken: false }); });
            (api?.modesGetActive?.() ?? Promise.resolve(null))
                .then((m) => { if (alive) setActiveMode(m ?? null); })
                .catch(() => { if (alive) setActiveMode(null); });
            (api?.profileGetStatus?.() ?? Promise.resolve(null))
                .then((p) => { if (alive) setProfile(p ?? null); })
                .catch(() => { if (alive) setProfile(null); });
        };
        readPermissions();
        readCredentials();
        readContext();
        const onFocus = () => { readPermissions(); readCredentials(); readContext(); };
        window.addEventListener('focus', onFocus);
        const offCreds = api?.onCredentialsChanged?.(readCredentials);
        const offModel = api?.onModelChanged?.(() => readCredentials());
        const offLicense = api?.onLicenseStatusChanged?.(readContext);
        const offTrial = api?.onTrialStarted?.(readContext);
        return () => {
            alive = false;
            window.removeEventListener('focus', onFocus);
            offCreds?.();
            offModel?.();
            offLicense?.();
            offTrial?.();
        };
    }, []);

    return {
        natively: nativelyStep(creds),
        permissions: checkFailed ? null : permissionsStep(platform, check),
        speech: speechStep(platform, creds),
        model: modelStep(creds, llm),
        mode: modeStep(contextUnlocked(license, trial), activeMode),
        profile: profileStep(contextUnlocked(license, trial), profile),
        loaded: !!creds && !!llm && (!!check || checkFailed)
            && !!license && !!trial && activeMode !== undefined && profile !== undefined,
    };
}

export const HelpSettings: React.FC<{
    onNavigate?: (tab: string) => void;
    /** Hands Settings over to the Modes manager, as the Launcher header's button does. */
    onOpenModes?: () => void;
    /** Hands Settings over to Profile Intelligence. */
    onOpenProfile?: () => void;
    /** Injectable for the harness and tests; defaults to the running OS. */
    platform?: string;
}> = ({ onNavigate, onOpenModes, onOpenProfile, platform = currentHelpPlatform() }) => {
    const t = useT();
    const tones = useSettingsTones();
    const { shortcuts } = useShortcuts();

    if (!isHelpPlatform(platform)) {
        // The app ships for macOS and Windows only. Neither branch's copy is
        // true anywhere else, so neither is borrowed.
        return (
            <SettingsNotice tone={tones.warn} icon={<TriangleAlert size={14} />}>
                {t('Setup & Help covers macOS and Windows.')}
            </SettingsNotice>
        );
    }

    return (
        // Collapse and Presence animate only once the pane says it is ready.
        // Guides have nothing to wait for, so the pane is ready at once; Get
        // started's status rows set their own readiness (see HelpPane).
        <SettingsMotionReady.Provider value>
            <HelpPane
                platform={platform}
                onNavigate={onNavigate}
                onOpenModes={onOpenModes}
                onOpenProfile={onOpenProfile}
                shortcuts={shortcuts}
                t={t}
                tones={tones}
            />
        </SettingsMotionReady.Provider>
    );
};

const HelpPane: React.FC<{
    platform: HelpPlatform;
    onNavigate?: (tab: string) => void;
    onOpenModes?: () => void;
    onOpenProfile?: () => void;
    shortcuts: ShortcutConfig;
    t: (text: string) => string;
    tones: ReturnType<typeof useSettingsTones>;
}> = ({ platform, onNavigate, onOpenModes, onOpenProfile, shortcuts, t, tones }) => {
    const facts = getPlatformFacts(platform);
    const rowCopy = getRowCopy(platform);
    const permissions = getPermissions(platform);
    const status = useSetupStatus(platform);
    // Status details are facts with a name in them ("Deepgram · key saved",
    // "Using Interview"): the fixed part is translated, the name is kept.
    const tDetail = (detail: string): string => {
        const whole = t(detail);
        if (whole !== detail) return whole;
        let m = /^(.+) · (runs on this computer|key saved|needs a key)$/.exec(detail);
        if (m) return `${m[1]} · ${t(m[2])}`;
        m = /^(.+) not allowed yet$/.exec(detail);
        if (m) return t('{items} not allowed yet').replace('{items}', m[1].split(' and ').map((x) => t(x)).join(t(' and ')));
        m = /^Using (.+)$/.exec(detail);
        if (m) return t('Using {name}').replace('{name}', m[1]);
        return detail;
    };
    // Get started opens on what is already true, with no motion: descriptions
    // don't swap away from "Checking…" for steps done long ago (SettingsRow's
    // rule — state already true on open isn't news).
    // Only a change while the pane is open, such as a permission granted in
    // System Settings, animates.
    const setupReady = useMotionReadyAfter(status.loaded);
    const isLight = useResolvedTheme() === 'light';
    const mac = platform === 'darwin';
    const go = (tab: string) => () => onNavigate?.(tab);
    const keys = (id: keyof ShortcutConfig) => <HelpKeys inline keys={shortcuts[id] ?? []} />;
    /** A guide's recording, when this platform may be shown it. */
    const clip = (id: keyof typeof HELP_CLIPS): HelpClipEntry | null => (facts.clips[id] ? HELP_CLIPS[id] : null);
    const answerClip = clip('answer');
    const autoAnswerClip = clip('autoanswer');
    const overlayClip = clip('overlay');
    const calendarClip = clip('calendar');
    const speechClip = clip('speech');
    const modelClip = clip('model');
    const retrievalClip = clip('retrieval');
    const phoneClip = clip('phone');
    const followupClip = clip('followup');
    const modesClip = clip('modes');
    const profileClip = clip('profile');
    const stealthClip = clip('stealth');
    const syncClip = clip('sync');
    const verifyClip = clip('verify');
    const notesClip = clip('notes');
    const searchClip = clip('search');

    // A step's action is the Liquid Glass action button (Companion's Connect) while
    // the step is still to do; once done it steps back to the neutral button,
    // still there to change it.
    // Status re-reads on focus and on credential/model changes, so a step can go
    // to-do -> done while the pane is on screen (allow the mic in System Settings,
    // come back): the blue action then trades places with the Go button
    // (Presence "control") instead of being swapped in one frame. Silent on load.
    const stepAction = (step: SetupStep | null, label: string, onClick: () => void) => (
        <Presence kind="control" id={step?.state === 'todo' ? 'todo' : 'go'}>
            {step?.state === 'todo' ? (
                <LiquidGlassButton variant="action" className="lg-sm" onClick={onClick}>
                    {label}
                </LiquidGlassButton>
            ) : (
                <GoButton label={label} onClick={onClick} />
            )}
        </Presence>
    );

    return (
        <div className="space-y-6 pb-10" data-settings-stagger>
            {/* ── Get started ─────────────────────────────────────────────── */}
            <section>
                <SettingsSectionHeading
                    title={t('Get started')}
                    subtitle={t('Natively needs permissions, a speech provider and an AI model.')}
                />
                {/* How Natively works, unlabelled: the answer path as a figure on
                    every platform, then, where one was recorded (macOS), the real
                    thing happening. */}
                <div className="mt-3 mb-2 space-y-2">
                    <HelpFigure>
                        <AnswerFlowFigure />
                    </HelpFigure>
                    {answerClip && (
                        <div className="pt-1">
                            <HelpClip clip={answerClip} label={answerClip.label} />
                        </div>
                    )}
                </div>
                <SettingsMotionReady.Provider value={setupReady}>
                <div className={ROW_GROUP}>
                    <SettingsRow
                        icon={<NativelyGlyph size={20} />}
                        title={t('Natively API')}
                        badge={
                            <Presence kind="badge" id={status.natively.state === 'todo' ? 'quickest' : null}>
                                <LiquidGlassBadge variant="neutral">{t('Quickest')}</LiquidGlassBadge>
                            </Presence>
                        }
                        description={tDetail(status.natively.detail)}
                        descriptionKey={status.natively.state}
                        control={onNavigate && <GoButton label={t('Plans & Billing')} onClick={go('plans')} />}
                    />
                    <SettingsRow
                        icon={<ShieldCheck size={20} />}
                        title={t('Allow permissions')}
                        description={tDetail(status.permissions?.detail ?? rowCopy.permissionsStep)}
                        descriptionKey={status.permissions?.detail ?? 'unknown'}
                        control={stepAction(status.permissions, t('Open'), () => openPermission(permissions[0]))}
                    />
                    <SettingsRow
                        icon={<AudioLines size={20} />}
                        title={t('Choose a speech provider')}
                        description={tDetail(status.speech.detail)}
                        descriptionKey={status.speech.detail}
                        control={onNavigate && stepAction(status.speech, t('Audio'), go('audio'))}
                    />
                    <SettingsRow
                        icon={<FlaskConical size={20} />}
                        title={t('Choose an AI model')}
                        description={tDetail(status.model.detail)}
                        descriptionKey={status.model.detail}
                        control={onNavigate && stepAction(status.model, t('AI Providers'), go('ai-providers'))}
                    />
                    {/* Optional, so never the blue call to action — but real steps:
                        each says what is set and opens its manager, which shows
                        its own Pro gate when locked. */}
                    <SettingsRow
                        icon={<LayoutGrid size={20} />}
                        title={t('Pick a mode')}
                        badge={
                            <Presence kind="badge" id={status.mode.state === 'locked' ? 'pro' : 'optional'}>
                                <LiquidGlassBadge variant="neutral">{status.mode.state === 'locked' ? t('Pro') : t('Optional')}</LiquidGlassBadge>
                            </Presence>
                        }
                        description={tDetail(status.mode.detail)}
                        descriptionKey={status.mode.detail}
                        control={onOpenModes && <GoButton label={t('Modes')} onClick={onOpenModes} />}
                    />
                    <SettingsRow
                        icon={<ProfileIntelligenceIcon size={20} />}
                        title={t('Add your résumé')}
                        badge={
                            <Presence kind="badge" id={status.profile.state === 'locked' ? 'pro' : 'optional'}>
                                <LiquidGlassBadge variant="neutral">{status.profile.state === 'locked' ? t('Pro') : t('Optional')}</LiquidGlassBadge>
                            </Presence>
                        }
                        description={tDetail(status.profile.detail)}
                        descriptionKey={status.profile.detail}
                        control={onOpenProfile && <GoButton label={t('Profile')} onClick={onOpenProfile} />}
                    />
                </div>
                </SettingsMotionReady.Provider>
            </section>

            {/* ── Shortcuts ───────────────────────────────────────────────── */}
            <section>
                <SettingsSectionHeading
                    title={t('Shortcuts')}
                    subtitle={t('The keys you will use most. Change any of them in Keybinds.')}
                />
                <div className={ROW_GROUP}>
                    <SettingsRow icon={<Eye size={20} />} title={t('Show or hide Natively')}
                        description={t('Works everywhere, even with global shortcuts off.')}
                        control={<HelpKeys keys={shortcuts.toggleVisibility ?? []} />} />
                    <SettingsRow icon={<MessageSquareText size={20} />} title={t('What to answer?')}
                        description={t('Answers the last thing said, with any screenshots you attached.')}
                        control={<HelpKeys keys={shortcuts.whatToAnswer ?? []} />} />
                    <SettingsRow icon={<MousePointerClick size={20} />} title={t('Use a suggestion')}
                        description={t('Takes the suggestion showing at the top of the overlay.')}
                        control={<HelpKeys keys={shortcuts.acceptSuggestion ?? []} />} />
                    <SettingsRow icon={<MonitorUp size={20} />} title={t('Capture screen & ask AI')}
                        description={t('Screenshots your whole screen and answers about it.')}
                        control={<HelpKeys keys={shortcuts.captureAndProcess ?? []} />} />
                    <SettingsRow icon={<Crop size={20} />} title={t('Selective screenshot')}
                        description={t('Drag over part of the screen to attach it to your next question.')}
                        control={<HelpKeys keys={shortcuts.selectiveScreenshot ?? []} />} />
                    <SettingsRow icon={<PointerOff size={20} />} title={t('Mouse passthrough')}
                        description={t('Clicks go through the overlay. Press again to click it.')}
                        control={<HelpKeys keys={shortcuts.toggleMousePassthrough ?? []} />} />
                    <SettingsRow icon={<Move size={20} />} title={t('Move the overlay')}
                        description={t('Nudges the overlay while a meeting is running.')}
                        control={<HelpKeys keys={moveKeys(shortcuts)} />} />
                    <SettingsRow icon={<Keyboard size={20} />} title={t('All shortcuts')}
                        description={t('Recap, Clarify, Follow Up, scrolling and more.')}
                        control={onNavigate && <GoButton label={t('Keybinds')} onClick={go('keybinds')} />} />
                </div>
                <SettingsFootnote icon={<Info size={13} />}>
                    {t('What to answer?, suggestions and moving the overlay only work while a meeting is running.')}
                    {facts.shortcutGuard && (
                        <> {t('Protect Natively shortcuts, in General, stops them from also typing into the app underneath.')}</>
                    )}
                </SettingsFootnote>
            </section>

            {/* ── Guides ──────────────────────────────────────────────────── */}
            <section>
                <SettingsSectionHeading
                    title={t('Guides')}
                    subtitle={t('Short recordings of each part of Natively. Press a step to jump to it.')}
                />
                <div className={ROW_GROUP}>
                    {/* Permissions */}
                    <HelpGuideRow icon={<ShieldCheck size={20} />} title={t('Permissions')} description={t(rowCopy.permissionsGuide)}>
                        {facts.clips.permissions ? (
                            <HelpFigure caption={t('Natively shows this card when it opens, until everything it needs is allowed.')}>
                                <img
                                    src={isLight ? PERMISSIONS_CARD.light : PERMISSIONS_CARD.dark}
                                    width={PERMISSIONS_CARD.size[0]}
                                    height={PERMISSIONS_CARD.size[1]}
                                    alt={t("Natively's permissions card: Screen Recording and Microphone, both showing Access granted.")}
                                    className="block w-full h-auto"
                                />
                            </HelpFigure>
                        ) : (
                            <HelpFigure>
                                <PermissionsFigure platform={platform} />
                            </HelpFigure>
                        )}
                        <p>{mac ? t('If you said no to either, turn it on by hand:') : `${t(permissions[0].why)} ${t("If Natively can't hear you:")}`}</p>
                        <HelpSteps
                            steps={[
                                ...permissions.map((permission) => (
                                    <>
                                        <HelpPath parts={permission.path} />
                                        {permission.olderTitle && <> {t('({title} on macOS 14 and earlier)').replace('{title}', t(permission.olderTitle))}</>}
                                        {mac ? <>{t(': turn on Natively. ')}</> : <>{t(': turn on both switches. ')}</>}
                                        <button type="button" onClick={() => openPermission(permission)} className="text-accent-primary underline decoration-transparent hover:decoration-current transition-colors duration-150 ease-out">
                                            {t('Open')}
                                        </button>
                                    </>
                                )),
                                facts.restartAfterGrant
                                    ? <>{t('Quit Natively and open it again. macOS applies screen permission after a restart.')}</>
                                    : <>{t('Start the meeting again.')}</>,
                            ]}
                        />
                        {facts.stealthTypingNeedsAccessibility && (
                            <p>{helpFill(t('Accessibility is only for Stealth Typing ({keys}). Natively asks the first time you use it.'), { keys: keys('focusInput') })}</p>
                        )}
                    </HelpGuideRow>

                    {/* Speech providers */}
                    <HelpGuideRow
                        icon={<AudioLines size={20} />}
                        title={t('Speech providers')}
                        description={t('Pick who turns the meeting into text, and your language.')}
                    >
                        {speechClip ? (
                            <HelpClip clip={speechClip} label={speechClip.label} />
                        ) : (
                            <p>
                                {helpFill(t('Choose one in {path}, paste its key, press Save, then Test Connection.'), { path: <HelpPath parts={['Audio', 'Speech Provider']} /> })}
                            </p>
                        )}
                        <HelpDefinitions
                            items={[
                                { term: 'Natively API', detail: t('Nothing to paste. It appears once your Natively key is saved.') },
                                { term: t('Local Models'), detail: t('Runs on this computer after a one-time download.') },
                                { term: 'Google Cloud', detail: t('A service-account JSON file, chosen with Select File.') },
                                { term: 'Azure Speech', detail: t('An API key and its Region, such as eastus.') },
                                { term: t('Everything else'), detail: t("An API key from the provider's console.") },
                            ]}
                        />
                        <p>{t('A few languages are offered only by the Parakeet local model.')} {t(facts.systemAudio.fix)}</p>
                    </HelpGuideRow>

                    {/* AI models */}
                    <HelpGuideRow
                        icon={<FlaskConical size={20} />}
                        title={t('AI models')}
                        description={t('Choose the model that answers, or bring your own.')}
                    >
                        {modelClip ? (
                            <HelpClip clip={modelClip} label={modelClip.label} />
                        ) : (
                            <p>
                                {helpFill(t('In {path}, add a key under Cloud Providers, then choose the model in Active Model.'), { path: <HelpPath parts={['AI Providers']} /> })}
                            </p>
                        )}
                        <p>{t("During a meeting, the model button under the overlay's ask box switches models without opening Settings.")}</p>
                        <HelpDefinitions
                            items={[
                                { term: 'Background Model', detail: t('Runs Auto Answer, quick background decisions and Fast Response Mode. Auto is recommended.') },
                                { term: t('Fast Response Mode'), detail: t("Text answers from the Background Model instead of the Active Model. On Auto, whichever connected model this computer has measured fastest. AI Providers says when it can't apply.") },
                                { term: 'Direct Assist', detail: t('Sends what you type, say or capture straight to the model, unprocessed. In beta.') },
                                { term: t('Custom Providers'), detail: helpFill(t('A cURL command, with {placeholder} where the question goes.'), { placeholder: <code className="font-mono text-text-primary">{'{{TEXT}}'}</code> }) },
                            ]}
                        />
                        <HelpSubhead>{t('Run a model on this computer')}</HelpSubhead>
                        <HelpSteps
                            steps={[
                                <>{helpFill(t('Install Ollama from {link}.'), { link: <HelpLink href={OLLAMA_DOWNLOAD_URL}>ollama.com</HelpLink> })}</>,
                                <div className="space-y-2">
                                    <div>{t('In {terminal}, download a model that can chat:').replace('{terminal}', facts.terminal)}</div>
                                    <HelpCommand command={OLLAMA_STARTER_COMMAND} />
                                </div>,
                                <>{helpFill(t('Open {path}. Natively finds Ollama by itself.'), { path: <HelpPath parts={['AI Providers', 'Local & Gateways']} /> })}</>,
                            ]}
                        />
                    </HelpGuideRow>

                    {/* The overlay */}
                    <HelpGuideRow icon={<PanelTop size={20} />} title={t('The overlay')} description={t('Every button on the overlay, and the pill above it.')}>
                        {overlayClip && <HelpClip clip={overlayClip} label={overlayClip.label} />}
                        <HelpFigure>
                            <OverlayAnatomyFigure />
                        </HelpFigure>
                        <HelpLegend
                            items={[
                                { title: t('The pill'), body: <>{helpFill(t('The logo opens the Launcher. Hide hides the overlay; {keys} brings it back. The square ends the meeting.'), { keys: keys('toggleVisibility') })}</> },
                                { title: t('Live transcript'), body: t('What is being said, as your speech provider hears it.') },
                                { title: t('Quick actions'), body: t('What to answer?, Clarify, Recap, Follow Up Question, and Answer, which records you. Settings › Overlay reorders them or swaps in Brainstorm, What did I miss?, Define or Sound smart.') },
                                { title: t('Ask box'), body: <>{helpFill(t('Type any question. {keys} attaches part of the screen.'), { keys: keys('selectiveScreenshot') })}</> },
                                { title: t('Model'), body: t('Switches the AI model.') },
                                { title: t('Quick settings'), body: t('Undetectable, Fast Response and Transcript.') },
                                { title: t('Mouse passthrough'), body: t('Lets clicks go through to the app behind.') },
                            ]}
                        />
                        <p>
                            {helpFill(t('A suggestion can appear at the top of the overlay, one at a time, such as Suggest response or Solve coding problem. Click it or press {keys}. Screenshots you take wait in a tray above the ask box until you ask.'), { keys: keys('acceptSuggestion') })}
                        </p>
                        <SettingsNotice tone={tones.warn} icon={<TriangleAlert size={14} />} className="mb-0">
                            {helpFill(t("With mouse passthrough on, the overlay can't be clicked. Press {keys} to turn it off."), { keys: keys('toggleMousePassthrough') })}
                        </SettingsNotice>
                    </HelpGuideRow>

                    {/* Auto Answer */}
                    <HelpGuideRow
                        icon={<AutoAnswerIcon size={20} />}
                        title={t('Auto Answer')}
                        description={t('Answers as soon as the interviewer finishes a question.')}
                    >
                        {autoAnswerClip && <HelpClip clip={autoAnswerClip} label={autoAnswerClip.label} />}
                        <p>
                            {helpFill(t('Turn it on in {path}, where it is marked Beta. Each question is answered when it ends, with nothing to press, and questions meant for someone else in the call are skipped.'), { path: <HelpPath parts={['General']} /> })}
                        </p>
                        <p>
                            {helpFill(t("Auto Answer runs on the Background Model, in {path}. What to answer? still works for anything it didn't answer."), { path: <HelpPath parts={['AI Providers']} /> })}
                        </p>
                    </HelpGuideRow>

                    {/* Meetings and search */}
                    <HelpGuideRow
                        icon={<FileText size={20} />}
                        title={t('Meetings and search')}
                        description={t('Notes after each meeting, asking about one, and finding it again.')}
                    >
                        {notesClip ? (
                            <HelpClip clip={notesClip} label={notesClip.label} />
                        ) : (
                            <p>{t('Open a meeting from the Launcher: Summary holds its notes, Transcript what was said, Usage what you asked.')}</p>
                        )}
                        <p>
                            {t("Notes and follow-up emails are written by Natively API, Groq, Gemini, a Codex or Antigravity sign-in, your own endpoint, or Ollama when it is your model. With only another cloud key, such as OpenAI, Claude, DeepSeek or OpenRouter, the Summary says Notes couldn't be generated. Usage lists what you asked during the meeting.")}
                        </p>
                        <HelpSubhead>{t('Follow-up email')}</HelpSubhead>
                        {followupClip && <HelpClip clip={followupClip} label={followupClip.label} />}
                        <p>
                            {t('Under the notes, Generate writes an email from them; change its tone or copy it. When the meeting is linked to a calendar event, its attendees fill To: and Open in Gmail starts the email there.')}
                        </p>
                        <HelpSubhead>{t('Find it again')}</HelpSubhead>
                        {searchClip && <HelpClip clip={searchClip} label={searchClip.label} />}
                        <p>
                            {helpFill(t('{keys} opens search in the Launcher and finds a meeting by its title; Enter asks AI instead. To keep nothing, turn on Do not save meetings in {path}.'), { keys: <HelpKeys inline keys={[facts.modifierKey, 'K']} />, path: <HelpPath parts={['General']} /> })}
                        </p>
                    </HelpGuideRow>

                    {/* Calendar */}
                    <HelpGuideRow
                        icon={<CalendarCheck size={20} />}
                        title={t('Calendar')}
                        description={t('Your next meetings, and notes that know which meeting they were.')}
                    >
                        {calendarClip && <HelpClip clip={calendarClip} label={calendarClip.label} />}
                        <HelpSteps
                            steps={[
                                <>{helpFill(t('In {path}, press Connect next to Google Calendar, Outlook, Apple Calendar (on a Mac) or a calendar link. Natively only reads your events.'), { path: <HelpPath parts={['Calendar']} /> })}</>,
                                t('Your next meetings appear there and on the Launcher. In Calendar, from 15 minutes before one starts, its Start Natively button starts a session linked to it.'),
                                t("A linked session takes the event's title and attendees. Your voice is labelled with your first name, and in a one-to-one the other person's is too."),
                            ]}
                        />
                        <p>
                            {t("To change the link, use the calendar button next to Copy on a meeting's notes, and pick the event or Not a calendar meeting.")}
                        </p>
                        <HelpSubhead>{t('Detect meetings')}</HelpSubhead>
                        <p>
                            {helpFill(t('On by default, in {path}, with or without a calendar: when a call starts in Zoom, Teams, Meet, Webex, Slack or another call app, Natively offers to start: a notice in the window and a notification. Turn on Start automatically to start after 10 seconds unless you press Not now. It stays quiet while Undetectable is on.'), { path: <HelpPath parts={['Calendar']} /> })}
                            {facts.meetingDetection && <> {t(facts.meetingDetection)}</>}
                        </p>
                    </HelpGuideRow>

                    {/* Modes */}
                    <HelpGuideRow
                        icon={<LayoutGrid size={20} />}
                        title={t('Modes')}
                        description={t('Tell Natively how to answer in each kind of meeting.')}
                    >
                        {modesClip ? (
                            <HelpClip clip={modesClip} label={modesClip.label} />
                        ) : (
                            <p>{t('Open Modes from the grid icon in the Launcher header, pick a mode, write its Real-time prompt, then Set active.')}</p>
                        )}
                        <p>
                            {helpFill(t("Reference files give a mode documents to answer from, and Deactivate returns to Natively's default. Modes and Profile Intelligence are part of Natively Pro, in {path}; a free trial opens both."), { path: <HelpPath parts={['Plans & Billing']} /> })}
                        </p>
                    </HelpGuideRow>

                    {/* Profile Intelligence */}
                    <HelpGuideRow
                        icon={<ProfileIntelligenceIcon size={20} />}
                        title={t('Profile Intelligence')}
                        description={t('Answers built from your résumé and the job you want.')}
                    >
                        {profileClip ? (
                            <HelpClip clip={profileClip} label={profileClip.label} />
                        ) : (
                            <p>{t('Open it from the person icon in the Launcher header, and upload your résumé and the job description.')}</p>
                        )}
                        <p>
                            {t('Only the Looking for work and Technical Interview modes use it. Company Intel researches the company, and Cover Letter drafts one from both documents.')}
                        </p>
                    </HelpGuideRow>

                    {/* Embeddings and rerankers */}
                    <HelpGuideRow
                        icon={<ListOrdered size={20} />}
                        title={t('Embeddings and rerankers')}
                        description={t('How Natively finds the right passage in your documents.')}
                    >
                        {retrievalClip && <HelpClip clip={retrievalClip} label={retrievalClip.label} />}
                        <p>
                            {helpFill(t("When you ask, the embedding model finds candidate passages in your documents, such as a mode's reference files, and the reranker picks the ones that answer. Choose both in {path}, separately from your AI model."), { path: <HelpPath parts={['Retrieval']} /> })}
                        </p>
                        <HelpDefinitions
                            items={[
                                { term: t('Hosted'), detail: t('Providers such as Natively API, Voyage AI, OpenAI or Jina AI. The text being searched is sent to that provider.') },
                                { term: t('On this device'), detail: t('Local Embeddings and Local Reranker come with Natively; more models download from Hugging Face. Nothing leaves this computer.') },
                                { term: t('Fall back to the local reranker'), detail: t('If a hosted reranker fails, reranking happens on this device instead.') },
                            ]}
                        />
                        <p>{t('Changing the embedding model re-indexes your files.')}</p>
                    </HelpGuideRow>

                    {/* Staying invisible */}
                    <HelpGuideRow
                        icon={<Ghost size={20} />}
                        title={t('Staying invisible')}
                        description={t('Keep Natively out of screen shares and recordings.')}
                    >
                        {stealthClip && <HelpClip clip={stealthClip} label={stealthClip.label} />}
                        <p>
                            {helpFill(t('Turn on the Detectable switch in {path}; it then reads Undetectable. Natively asks the system to keep its windows out of screen shares and recordings, and hides {hides}.'), { path: <HelpPath parts={['General']} />, hides: t(facts.undetectable.hides) })}
                            {' '}{t(facts.undetectable.caveat)}
                        </p>
                        <p>
                            {t("Process Disguise makes Natively look like {apps} while Undetectable is on. Choose it first: it can't be changed while Undetectable is on.").replace('{apps}', facts.disguises.map((name) => t(name)).join(', ').replace(/, ([^,]*)$/, `${t(' or ')}$1`))}
                        </p>
                        <SettingsNotice tone={tones.warn} icon={<TriangleAlert size={14} />} className="mb-0">
                            {t('Check with a test share before a call that matters.')}
                        </SettingsNotice>
                        {facts.zoomGuide && (
                            <>
                                <HelpSubhead>Zoom</HelpSubhead>
                                <p>
                                    {helpFill(t('In {path}, set Screen capture mode to Advanced capture with window filtering. The other modes capture Natively.'), { path: <HelpPath parts={['Zoom', 'Settings', 'Share Screen', 'Advanced']} /> })}
                                </p>
                                <HelpFigure>
                                    <img
                                        src={zoomCaptureModeScreenshot}
                                        width={1212}
                                        height={1008}
                                        alt={t("Zoom's Share Screen settings, with Screen capture mode set to Advanced capture with window filtering")}
                                        className="block w-full"
                                    />
                                </HelpFigure>
                            </>
                        )}
                    </HelpGuideRow>

                    {/* Phone and browser */}
                    <HelpGuideRow
                        icon={<Smartphone size={20} />}
                        title={t('Phone and browser')}
                        description={t('The overlay on your phone, and web pages sent to Natively.')}
                    >
                        {phoneClip && <HelpClip clip={phoneClip} label={phoneClip.label} />}
                        <p>
                            {t("Phone Mirror shows the live transcript and each answer as it is written, with the overlay's buttons: tap What to Say for an answer, ask in the text box, or send a photo or screenshot from the phone. Clearing the screen there clears only the phone.")}
                        </p>
                        <HelpSubhead>{t('Pair a phone')}</HelpSubhead>
                        {syncClip ? (
                            <HelpClip clip={syncClip} label={syncClip.label} />
                        ) : (
                            <HelpSteps
                                steps={[
                                    <>{helpFill(t('In {path}, turn on Enable Phone Mirror.'), { path: <HelpPath parts={['Companion']} /> })}</>,
                                    t('Turn on Allow LAN access so your phone can reach it over the same Wi-Fi.'),
                                    t("On Pair a phone, press Show code and scan it with your phone's camera."),
                                ]}
                            />
                        )}
                        <SettingsNotice tone={tones.warn} icon={<TriangleAlert size={14} />} className="mb-0">
                            {t('Allow LAN access only on networks you trust. Anyone with the pairing link can read your answers until you press Reset pairing.')}
                        </SettingsNotice>
                        <HelpSubhead>{t('Browser extension')}</HelpSubhead>
                        <HelpSteps
                            steps={[
                                <>{helpFill(t('Install Natively Companion from the {link}.'), { link: <HelpLink href={CHROME_WEB_STORE_URL}>Chrome Web Store</HelpLink> })}</>,
                                <>{helpFill(t('With Phone Mirror on, press Connect on its row in {path}.'), { path: <HelpPath parts={['Companion']} /> })}</>,
                                t("Within a minute, click the extension's icon and press Connect to Natively."),
                            ]}
                        />
                        <p>
                            {helpFill(t("Then {keys} sends the page you're reading. Smart Browser Context, also in Companion, spots coding and interview pages and attaches the problem when you ask."), { keys: keys('capturePage') })}
                        </p>
                    </HelpGuideRow>

                    {/* Verify coding answers */}
                    <HelpGuideRow
                        icon={<Code size={20} />}
                        title={t('Verify coding answers')}
                        description={t('Runs the code in an answer to check it, and fixes it if it fails.')}
                    >
                        {verifyClip ? (
                            <HelpClip clip={verifyClip} label={verifyClip.label} />
                        ) : (
                            <p>{helpFill(t('Turn it on in {path}.'), { path: <HelpPath parts={['General', 'Show advanced settings']} /> })}</p>
                        )}
                        <p>
                            {t('A passing answer shows ✓ verified. A failing one goes back to the model with the error, and is replaced by a Corrected answer only if the fix passes too.')}
                        </p>
                        <p>
                            {t('It uses tools already on this computer: {python}, node, g++, javac and java, go, and sqlite3.').replace('{python}', facts.pythonCommand.replace(' or ', t(' or ')))}
                            {facts.sqliteBundled ? '' : t(" sqlite3 doesn't come with Windows.")} {t('A language without its tool is skipped.')}
                        </p>
                    </HelpGuideRow>
                </div>
            </section>
        </div>
    );
};
