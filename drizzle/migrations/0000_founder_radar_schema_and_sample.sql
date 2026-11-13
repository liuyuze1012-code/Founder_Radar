CREATE TABLE public.theses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  school_ids text[] NOT NULL DEFAULT '{}',
  window_days int NOT NULL DEFAULT 60,
  lane_sizes jsonb NOT NULL DEFAULT '{"pre_intent":5,"exploring":3,"already_moving":2}',
  keywords text[],
  fields text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id uuid NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  stage text,
  position jsonb,
  counts jsonb NOT NULL DEFAULT '{}',
  models jsonb,
  rules_version text,
  error text,
  is_sample boolean NOT NULL DEFAULT false,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz
);
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('paper','grant','repo','trial','patent')),
  source_id text, doi text, title text, summary text, item_date date, url text,
  verdict text CHECK (verdict IN ('pass','unclear','drop')),
  fit int, applied text, use_case text, reason text,
  limited_info boolean NOT NULL DEFAULT false,
  raw jsonb
);
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openalex_id text UNIQUE,
  name text NOT NULL,
  school text,
  tracks text[] NOT NULL DEFAULT '{}',
  first_year int,
  identity_confidence text CHECK (identity_confidence IN ('high','medium')),
  identity_reasons text[],
  is_sample boolean NOT NULL DEFAULT false
);
CREATE TABLE public.person_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  role text, confidence text, reasons text[]
);
CREATE TABLE public.evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  signal_type text,
  score_group text CHECK (score_group IN ('research','propensity','timing','lane')),
  label text, value text, points int, max_points int,
  status text CHECK (status IN ('observed','not_applicable','unknown')),
  source_url text, event_date date,
  retrieved_at timestamptz DEFAULT now(),
  link_confidence text
);
CREATE TABLE public.picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  lane text CHECK (lane IN ('pre_intent','exploring','already_moving')),
  lane_reason text,
  research_score numeric(3,1), research_coverage text,
  propensity_score numeric(3,1), propensity_coverage text,
  timing_score numeric(3,1), timing_coverage text,
  rank int, action text,
  in_digest boolean NOT NULL DEFAULT false,
  below_bar_reason text, why text, intro_paths jsonb
);
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  product text, buyer text, competitors text, distance_to_market text, risks text, unverified text,
  facts jsonb, model text, validated boolean NOT NULL DEFAULT false
);

CREATE INDEX ON public.picks(scan_id);
CREATE INDEX ON public.evidence(person_id, scan_id);
CREATE INDEX ON public.items(scan_id);
CREATE INDEX ON public.scans(status, finished_at);
CREATE INDEX ON public.cases(scan_id, person_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['theses','scans','items','people','person_items','evidence','picks','cases'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Anyone can read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
  END LOOP;
END $$;

-- ===== Sample data =====
INSERT INTO public.theses (id, text, school_ids, window_days, lane_sizes, keywords, fields) VALUES
('a0000000-0000-0000-0000-000000000001','AI for drug discovery',
 ARRAY['jhu','umd','georgetown','gwu','vt'],60,'{"pre_intent":5,"exploring":3,"already_moving":2}',
 ARRAY['machine learning','drug discovery','molecular generation','protein structure'],ARRAY['Pharmacology','Computer Science','Biochemistry']);

INSERT INTO public.scans (id, thesis_id, status, stage, counts, models, rules_version, is_sample, started_at, finished_at) VALUES
('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','done','done',
 '{"collect":500,"clean":400,"screen":50,"resolve":60,"enrich":50,"cases":10}',
 '{"small":"anthropic/claude-haiku-4-5","large":"anthropic/claude-sonnet-5"}','sample-1',true,
 now() - interval '2 hours', now() - interval '1 hour');

CREATE TEMP TABLE _sp (n int, name text, school text, track text, first_year int, conf text, lane text,
  rs numeric, ps numeric, ts numeric, rnk int, action text, dig boolean, why text, product text, buyer text) ON COMMIT DROP;
INSERT INTO _sp VALUES
(1,'Dr. Maya Okafor','Johns Hopkins','Therapeutics',2014,'high','pre_intent',9.1,6.2,7.4,1,'Meet now',true,'Lead author on a generative model that cut hit-to-lead time in kinase inhibitors.','Generative design engine for kinase inhibitors','Mid-size oncology biotechs'),
(2,'Dr. Arjun Mehta','University of Maryland','Platform',2016,'high','pre_intent',8.7,5.9,6.8,2,'Meet now',true,'Built an open-source protein–ligand scoring tool with fast-growing adoption.','Hosted binding-affinity prediction API','Pharma computational chemistry teams'),
(3,'Dr. Lena Novak','Georgetown','Diagnostics',2012,'medium','pre_intent',8.2,6.5,6.1,3,'Get to know',true,'Graph models predicting drug toxicity from patient biomarker panels.','Toxicity-risk screening panel','Clinical trial sponsors'),
(4,'Dr. Samuel Reyes','Virginia Tech','Platform',2017,'high','pre_intent',7.9,5.4,7.0,4,'Get to know',true,'Active-learning loop for wet-lab assay planning, recently NSF-funded.','Self-driving lab scheduling software','Contract research organizations'),
(5,'Dr. Hana Kim','George Washington University','Therapeutics',2015,'medium','pre_intent',7.6,6.0,5.8,5,'Watch',true,'Repurposing models that flagged two candidates now in preclinical testing.','Drug repurposing discovery service','Rare-disease foundations'),
(6,'Dr. Tomás Alvarez','Johns Hopkins','Diagnostics',2018,'high','pre_intent',7.1,4.8,5.5,6,'Watch',false,'Strong imaging-to-response models; early in career.','Response-prediction imaging tool','Oncology clinics'),
(7,'Dr. Priya Raman','University of Maryland','Therapeutics',2013,'medium','pre_intent',6.9,4.5,5.0,7,'Watch',false,'Peptide design papers with steady citations.','Peptide therapeutic design','Peptide-focused biotechs'),
(8,'Dr. Daniel Brooks','Virginia Tech','Platform',2019,'medium','pre_intent',6.4,4.9,4.6,8,'Watch',false,'Promising cheminformatics library, limited public signal.','Cheminformatics toolkit','Academic labs'),
(9,'Dr. Fatima Haddad','Georgetown','Therapeutics',2011,'high','exploring',8.4,7.8,8.1,1,'Meet now',true,'Took an I-Corps cohort this fall and filed a provisional patent on an antiviral scaffold.','AI-designed broad-spectrum antivirals','Biodefense agencies and pharma'),
(10,'Dr. Wei Zhang','Johns Hopkins','Platform',2014,'high','exploring',8.0,7.5,7.7,2,'Meet now',true,'Spoke at a pharma partnering event about licensing a retrosynthesis model.','Retrosynthesis planning software','Process chemistry groups'),
(11,'Dr. Grace Thompson','George Washington University','Diagnostics',2010,'high','already_moving',8.8,8.9,8.5,1,'Meet now',true,'Co-founded a stealth company registered in Delaware last month.','Companion diagnostic for AI-selected therapies','Precision oncology pharma'),
(12,'Dr. Omar Siddiqui','University of Maryland','Therapeutics',2012,'high','already_moving',8.5,8.6,8.0,2,'Meet now',true,'Received an SBIR Phase I award as PI of a new startup.','ML-guided antibody optimization','Biologics companies'),
(13,'Dr. Elena Petrova','Virginia Tech','Platform',2015,'medium','already_moving',7.8,8.0,7.2,3,'Get to know',false,'LinkedIn lists a CTO role at an early-stage company.','Lab automation data layer','Biotech R&D labs'),
(14,'Dr. Marcus Johnson','Johns Hopkins','Therapeutics',2009,'high','already_moving',7.5,7.9,6.9,4,'Get to know',false,'Advisor to a seed-stage biotech spun out of his lab.','Small-molecule design for CNS targets','Neuroscience pharma'),
(15,'Dr. Aisha Bello','Georgetown','Diagnostics',2016,'medium','already_moving',7.2,7.6,6.5,5,'Watch',false,'Company website lists her as co-founder; product unclear.','Digital biomarker platform','Trial sponsors'),
(16,'Dr. Lucas Ferreira','George Washington University','Platform',2017,'medium','already_moving',6.9,7.1,6.2,6,'Watch',false,'Startup formed but little activity this quarter.','Molecular simulation cloud','Computational chemists'),
(17,'Dr. Nina Schultz','University of Maryland','Diagnostics',2014,'high','already_moving',6.7,7.4,5.9,7,'Watch',false,'Company exists; already raised from another investor.','Pathology AI for trial enrollment','CROs'),
(18,'Dr. Kofi Mensah','Virginia Tech','Therapeutics',2018,'medium','already_moving',6.3,6.8,5.6,8,'Watch',false,'Incorporated an LLC; unclear if active.','Veterinary drug discovery models','Animal health companies'),
(19,'Dr. Sofia Rossi','Johns Hopkins','Platform',2013,'high','already_moving',6.0,7.0,5.2,9,'Watch',false,'Early founder of a now-acquired startup; new venture rumored.','Assay data harmonization','Pharma data teams'),
(20,'Dr. Ethan Park','Georgetown','Therapeutics',2019,'medium','already_moving',5.8,6.5,5.0,10,'Watch',false,'Listed on a startup accelerator roster.','Generative RNA therapeutics','RNA biotechs');

INSERT INTO public.people (id, openalex_id, name, school, tracks, first_year, identity_confidence, identity_reasons, is_sample)
SELECT ('c0000000-0000-0000-0000-0000000000' || lpad(n::text,2,'0'))::uuid, 'A-SAMPLE-' || n, name, school, ARRAY[track], first_year, conf,
  CASE WHEN conf='high' THEN ARRAY['ORCID matches institution','Consistent co-author network'] ELSE ARRAY['Name matches institution profile','No ORCID found'] END, true
FROM _sp;

INSERT INTO public.picks (scan_id, person_id, lane, lane_reason, research_score, research_coverage, propensity_score, propensity_coverage,
  timing_score, timing_coverage, rank, action, in_digest, below_bar_reason, why, intro_paths)
SELECT 'b0000000-0000-0000-0000-000000000001', ('c0000000-0000-0000-0000-0000000000' || lpad(n::text,2,'0'))::uuid, lane,
  CASE lane WHEN 'pre_intent' THEN 'No company, patent filing or commercialization activity found'
            WHEN 'exploring' THEN 'Commercialization program or patent activity found, no company yet'
            ELSE 'Company registration or founder role found' END,
  rs, '5 of 6 signals observed', ps, '4 of 6 signals observed', ts, '3 of 4 signals observed',
  rnk, action, dig,
  CASE WHEN dig THEN NULL ELSE 'Ranked below the lane size for this week' END,
  why,
  jsonb_build_array(
    jsonb_build_object('type','co-author','name','Prof. ' || split_part(name,' ',3) || ' collaborator','detail','Shared 3 papers in the last two years'),
    jsonb_build_object('type','tech transfer','name', school || ' Office of Technology Transfer','detail','Handles licensing for this lab'))
FROM _sp;

INSERT INTO public.cases (scan_id, person_id, product, buyer, competitors, distance_to_market, risks, unverified, facts, model, validated)
SELECT 'b0000000-0000-0000-0000-000000000001', ('c0000000-0000-0000-0000-0000000000' || lpad(n::text,2,'0'))::uuid,
  product, buyer, 'Recursion, Insilico Medicine, Schrödinger',
  CASE lane WHEN 'pre_intent' THEN '3–5 years: needs validation data' WHEN 'exploring' THEN '2–3 years: pilot partners needed' ELSE '1–2 years: early product exists' END,
  'Data access, crowded AI drug discovery market, long sales cycles',
  'Researcher interest in starting a company; IP ownership terms with the university',
  jsonb_build_object('publications_last_2y', 4 + (n % 6), 'grants', 1 + (n % 3)),
  'anthropic/claude-sonnet-5', false
FROM _sp;

CREATE TEMP TABLE _ev (k int, signal_type text, score_group text, label text, value text, points int, max_points int, url text) ON COMMIT DROP;
INSERT INTO _ev VALUES
(1,'top_paper','research','Highly cited recent paper','Top 5% citations in field (2025)',4,5,'https://openalex.org/'),
(2,'grant','research','Active federal grant','NIH R01, $1.9M',3,4,'https://reporter.nih.gov/'),
(3,'industry_collab','propensity','Industry co-authors','2 papers with pharma co-authors',3,4,'https://openalex.org/'),
(4,'patent','timing','Patent filing','Provisional application filed',3,3,'https://patents.google.com/'),
(5,'repo_activity','propensity','Open-source repo activity','Commits up 40% in last 60 days',2,3,'https://github.com/'),
(6,'company_signal','lane','Company or program signal','I-Corps participant / company registration',2,2,'https://opencorporates.com/');

INSERT INTO public.evidence (person_id, scan_id, signal_type, score_group, label, value, points, max_points, status, source_url, event_date, link_confidence)
SELECT ('c0000000-0000-0000-0000-0000000000' || lpad(p.n::text,2,'0'))::uuid, 'b0000000-0000-0000-0000-000000000001',
  e.signal_type, e.score_group, e.label,
  CASE WHEN e.k = 6 AND p.lane = 'pre_intent' THEN 'None found' ELSE e.value END,
  CASE WHEN e.k = 6 AND p.lane = 'pre_intent' THEN 0 ELSE greatest(0, e.points - (p.n % 2)) END, e.max_points,
  CASE WHEN e.k = 6 AND p.lane = 'pre_intent' THEN 'not_applicable' ELSE 'observed' END,
  e.url, (date '2026-11-01' - ((p.n * 3 + e.k * 5) % 55)), CASE WHEN p.conf='high' THEN 'high' ELSE 'medium' END
FROM _sp p JOIN _ev e ON e.k <= 3 + (p.n % 4) OR (e.k = 6 AND p.lane <> 'pre_intent');

INSERT INTO public.items (id, scan_id, source, source_id, title, summary, item_date, url, verdict, fit, applied, use_case, reason)
SELECT ('d0000000-0000-0000-0000-0000000000' || lpad(n::text,2,'0'))::uuid, 'b0000000-0000-0000-0000-000000000001', 'paper', 'W-SAMPLE-' || n,
  'Sample paper: ' || product, 'Fictional sample item for ' || name, date '2026-10-01' - n, 'https://openalex.org/', 'pass', 6 + (n % 4),
  'applied', product, 'Matches thesis'
FROM _sp;

INSERT INTO public.person_items (person_id, item_id, role, confidence, reasons)
SELECT ('c0000000-0000-0000-0000-0000000000' || lpad(n::text,2,'0'))::uuid, ('d0000000-0000-0000-0000-0000000000' || lpad(n::text,2,'0'))::uuid,
  'first_author', conf, ARRAY['Institution matches']
FROM _sp;