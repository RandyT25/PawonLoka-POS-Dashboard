update ingredients
set conversions = coalesce(conversions, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('unit','kg','qty',1000,'sku','','last_price',0))
where unit = 'gr'
  and not exists (
    select 1 from jsonb_array_elements(coalesce(conversions,'[]'::jsonb)) elem
    where lower(elem->>'unit') = 'kg'
  );
