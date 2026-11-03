-- Old controls retain their original denominator, answers and severe-fault history.
alter table public.quality_reviews add column max_score smallint not null default 4
 check (max_score in (4,5));
alter table public.quality_reviews alter column max_score set default 5;
alter table public.quality_reviews drop constraint quality_score_matches;
alter table public.quality_reviews add constraint quality_score_matches
 check (score_sum<=max_score*applicable_count and
        score_percent=round(score_sum::numeric*100/(max_score*applicable_count),4));
alter table public.quality_reviews add constraint quality_rubric_scale_matches
 check ((rubric_key='mega_call_v1' and max_score=4) or
        (rubric_key='mega_call_v2' and max_score=5 and grave_faults='[]'::jsonb and status<>'Non conforme — faute grave'));
