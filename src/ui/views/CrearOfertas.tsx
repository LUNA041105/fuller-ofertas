import { useEffect, useMemo, useRef, useState } from 'react';
import type { AspectFormat, Campaign } from '../../shared/types';
import logoUrl from '../assets/fuller-logo.png';
import { Stepper } from './crear/Stepper';
import { Step1Campaign } from './crear/Step1Campaign';
import { Step2Files } from './crear/Step2Files';
import { StepReview } from './crear/StepReview';
import { Step3Format } from './crear/Step3Format';
import { Step4Results } from './crear/Step4Results';
import type { StepId, WizardFile, WizardResult, PageRegions } from './crear/types';
import { pageKey } from './crear/types';

interface Props {
  onHome: () => void;
}

// Asistente "Crear nuevas ofertas" (4 pasos). Reutiliza los handlers del main.
// Cada pagina seleccionada produce una pieza (spread simple).
export function CrearOfertas({ onHome }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logoOk, setLogoOk] = useState(true);

  const [step, setStep] = useState<StepId>(1);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [files, setFiles] = useState<WizardFile[]>([]);
  // Regiones detectadas/confirmadas por pagina (clave pageKey).
  const [regionsByPage, setRegionsByPage] = useState<Record<string, PageRegions>>({});
  const [format, setFormat] = useState<AspectFormat | null>(null);
  const [results, setResults] = useState<WizardResult[]>([]);
  const [resultsStale, setResultsStale] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Identifica la corrida de generacion actual: una nueva corrida invalida la anterior.
  const runIdRef = useRef(0);

  async function loadCampaigns() {
    const list = await window.fuller.listCampaigns();
    setCampaigns(list);
    return list;
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const [step2sub, setStep2sub] = useState<'upload' | 'review'>('upload');

  const totalSelectedPages = useMemo(
    () => files.reduce((n, f) => n + f.selectedPages.size, 0),
    [files]
  );

  // Paginas seleccionadas (pares originalId+pageIndex), en orden.
  const selectedPageList = useMemo(() => {
    const list: { originalId: string; pageIndex: number }[] = [];
    for (const f of files) {
      for (const p of [...f.selectedPages].sort((a, b) => a - b)) {
        list.push({ originalId: f.originalId, pageIndex: p });
      }
    }
    return list;
  }, [files]);

  // Total de regiones confirmadas en las paginas seleccionadas = piezas a generar.
  const totalRegions = useMemo(() => {
    let n = 0;
    for (const pg of selectedPageList) {
      const pr = regionsByPage[pageKey(pg.originalId, pg.pageIndex)];
      // Si no hay deteccion, cuenta como 1 (pagina completa).
      n += pr && pr.regions.length > 0 ? pr.regions.length : 1;
    }
    return n;
  }, [selectedPageList, regionsByPage]);

  // Validez por paso (para habilitar "Continuar" y bloquear saltos).
  const step1Valid = !!campaign;
  const step2Valid = totalSelectedPages > 0;
  const step3Valid = !!format;

  // Paso maximo alcanzable segun lo completado.
  const maxReachable: StepId = !step1Valid
    ? 1
    : !step2Valid
    ? 2
    : results.length > 0
    ? 4
    : 3;

  // Marcar resultados como obsoletos si cambian archivos o formato tras generar.
  function markStaleOnFilesChange(updater: (prev: WizardFile[]) => WizardFile[]) {
    setFiles(updater);
    if (results.length > 0) setResultsStale(true);
  }
  function chooseFormat(f: AspectFormat) {
    if (results.length > 0 && f !== format) setResultsStale(true);
    setFormat(f);
  }

  // Genera una pieza por cada pagina seleccionada (en serie para progreso real).
  async function generateAll() {
    if (!campaign || !format) return;
    // Nueva corrida: invalida cualquier corrida anterior en curso.
    const myRun = runIdRef.current + 1;
    runIdRef.current = myRun;
    setGenerating(true);
    setResultsStale(false);

    // Construye los trabajos: una pieza por REGION confirmada de cada pagina.
    // Si una pagina no tiene regiones, se usa la pagina completa (1 pieza).
    const jobs: {
      originalId: string;
      pageIndex: number;
      cropRegion: { x: number; y: number; w: number; h: number } | null;
    }[] = [];
    for (const pg of selectedPageList) {
      const pr = regionsByPage[pageKey(pg.originalId, pg.pageIndex)];
      if (pr && pr.regions.length > 0) {
        for (const r of pr.regions) {
          jobs.push({
            originalId: pg.originalId,
            pageIndex: pg.pageIndex,
            cropRegion: { x: r.x, y: r.y, w: r.w, h: r.h },
          });
        }
      } else {
        jobs.push({ originalId: pg.originalId, pageIndex: pg.pageIndex, cropRegion: null });
      }
    }

    // Inicializa tarjetas en estado "generating".
    const initial: WizardResult[] = jobs.map((j, i) => ({
      pieceId: `pending-${i}`,
      versionId: null,
      previousVersionId: null,
      originalId: j.originalId,
      pageIndex: j.pageIndex,
      name: '',
      imageUrl: null,
      status: 'generating',
      warnings: [],
    }));
    setResults(initial);
    setStep(4);

    for (let i = 0; i < jobs.length; i++) {
      // Si se inicio otra corrida (o se cancelo), abandona esta.
      if (runIdRef.current !== myRun) return;
      const j = jobs[i];
      try {
        const spread = await window.fuller.createSpread({
          campaignId: campaign.id,
          originalId: j.originalId,
          pdfPageIndices: [j.pageIndex],
          cropRegion: j.cropRegion,
        });
        const piece = await window.fuller.createPiece({
          campaignId: campaign.id,
          spreadIds: [spread.id],
          format,
        });
        const version = await window.fuller.generatePiece(piece.id);
        if (runIdRef.current !== myRun) return; // corrida superada
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  pieceId: piece.id,
                  versionId: version.id,
                  imageUrl: version.imageUrl,
                  warnings: version.warnings,
                  status: version.status === 'error' ? 'error' : 'done',
                  error: version.errorMessage ?? undefined,
                }
              : r
          )
        );
      } catch (e) {
        if (runIdRef.current !== myRun) return;
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: 'error', error: (e as Error).message } : r
          )
        );
      }
    }

    // Solo la corrida vigente apaga el indicador.
    if (runIdRef.current === myRun) setGenerating(false);
  }

  function next() {
    if (step === 1 && step1Valid) {
      setStep(2);
      setStep2sub('upload');
    } else if (step === 2 && step2Valid) {
      if (step2sub === 'upload') setStep2sub('review');
      else setStep(3);
    } else if (step === 3 && step3Valid) {
      generateAll();
    }
  }

  function back() {
    if (step === 3) {
      setStep(2);
      setStep2sub('review');
    } else if (step === 2) {
      if (step2sub === 'review') setStep2sub('upload');
      else setStep(1);
    } else if (step > 1) {
      setStep((step - 1) as StepId);
    }
  }

  // Volver desde Resultados: cancela cualquier generacion en curso para no
  // dejar el indicador "Generando..." atascado al regenerar.
  function backFromResults() {
    runIdRef.current += 1; // invalida la corrida actual
    setGenerating(false);
    setStep(3);
  }

  function tryExit() {
    const hasWork = !!campaign || files.length > 0 || results.length > 0;
    if (!hasWork) {
      onHome();
      return;
    }
    const leave = confirm(
      'Tienes trabajo sin guardar en la app. Descargar no es lo mismo que guardar.\n\n' +
        'Aceptar: salir sin guardar.\nCancelar: seguir editando.'
    );
    if (leave) onHome();
  }

  const continueHint =
    step === 1
      ? 'Selecciona o crea una campaña.'
      : step === 2
      ? 'Agrega y selecciona al menos una pagina.'
      : step === 3
      ? 'Elige un formato.'
      : '';

  return (
    <div className="wz">
      <header className="lib-header">
        <div className="lib-header-left">
          {logoOk ? (
            <img className="lib-logo" src={logoUrl} alt="Fuller" onError={() => setLogoOk(false)} />
          ) : (
            <span className="fh-logo-fallback">fuller</span>
          )}
          <button className="lib-back" onClick={tryExit}>
            ← Inicio
          </button>
        </div>
        <div className="lib-header-center">
          <strong>Crear ofertas</strong>
        </div>
        <div className="lib-header-right" />
      </header>

      <div className="wz-stepbar">
        <Stepper
          current={step}
          maxReachable={maxReachable}
          onGo={(s) => {
            // Permite volver a pasos ya alcanzables sin perder datos.
            if (s <= maxReachable) setStep(s);
          }}
        />
      </div>

      <main className="wz-body">
        {step === 1 && (
          <Step1Campaign
            campaigns={campaigns}
            selected={campaign}
            onSelect={setCampaign}
            onCampaignsChanged={loadCampaigns}
          />
        )}
        {step === 2 && campaign && step2sub === 'upload' && (
          <Step2Files
            campaign={campaign}
            files={files}
            setFiles={markStaleOnFilesChange}
            regionsByPage={regionsByPage}
            setRegionsByPage={setRegionsByPage}
          />
        )}
        {step === 2 && campaign && step2sub === 'review' && (
          <StepReview
            pages={selectedPageList}
            files={files}
            regionsByPage={regionsByPage}
            setRegionsByPage={setRegionsByPage}
          />
        )}
        {step === 3 && campaign && (
          <Step3Format
            campaign={campaign}
            format={format}
            onSelect={chooseFormat}
            filesLoaded={files.length}
            piecesExpected={totalRegions}
          />
        )}
        {step === 4 && campaign && format && (
          <>
            {resultsStale && (
              <div className="wz-stale">
                Cambiaste archivos o formato. Los resultados actuales no reflejan esos
                cambios. Vuelve al paso 3 y pulsa "Generar imagenes" para rehacerlos.
              </div>
            )}
            <Step4Results
              campaign={campaign}
              format={format}
              results={results}
              setResults={setResults}
            />
          </>
        )}
      </main>

      <footer className="wz-footer">
        {step === 1 ? (
          <button onClick={tryExit}>Cancelar</button>
        ) : (
          <button onClick={step === 4 ? backFromResults : back}>← Atras</button>
        )}

        <div className="wz-footer-right">
          {step < 4 && continueHint && !isStepValid(step, step1Valid, step2Valid, step3Valid) && (
            <span className="wz-muted">{continueHint}</span>
          )}
          {step === 1 && (
            <button className="primary" onClick={next} disabled={!step1Valid}>
              Continuar
            </button>
          )}
          {step === 2 && (
            <button className="primary" onClick={next} disabled={!step2Valid}>
              {step2sub === 'upload' ? 'Revisar ofertas detectadas' : 'Continuar'}
            </button>
          )}
          {step === 3 && (
            <button className="primary" onClick={next} disabled={!step3Valid || generating}>
              {generating ? 'Generando...' : `Generar ${totalRegions} imagenes`}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function isStepValid(
  step: StepId,
  s1: boolean,
  s2: boolean,
  s3: boolean
): boolean {
  if (step === 1) return s1;
  if (step === 2) return s2;
  if (step === 3) return s3;
  return true;
}
