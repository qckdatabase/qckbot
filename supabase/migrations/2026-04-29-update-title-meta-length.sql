-- Title (and Title Tag) max 60 chars; Meta Description max 160 chars.

UPDATE guardrail_templates
SET template_content = E'Title: [SEO-shaped title containing the primary keyword, <=60 chars]\nProposed URL: /[primary-keyword-as-slug]  -- slug MUST be the primary keyword (kebab-case)\nTitle Tag: [SEO title that contains the primary keyword, <=60 chars]\nMeta Description: [<=160 chars, includes primary keyword]\nContent Intent: [middle-of-funnel, informational/commercial]\nTarget Keyword: [primary keyword]'
WHERE content_type = 'blog' AND field_name = 'metadata';

UPDATE guardrail_templates
SET template_content = E'Title: [primary keyword verbatim, <=60 chars]  -- title MUST equal the primary keyword\nProposed URL: /[primary-keyword-as-slug]  -- slug MUST be the primary keyword (kebab-case)\nTitle Tag: [primary keyword, <=60 chars]  -- mirrors the keyword; brand suffix optional\nMeta Description: [<=160 chars, includes primary keyword]\nContent Intent: [bottom-of-funnel, commercial]\nTarget Keyword: [primary keyword]'
WHERE content_type = 'shoppable' AND field_name = 'metadata';
