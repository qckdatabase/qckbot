-- Update existing guardrail metadata templates so:
--   - Shoppable: title AND slug = primary keyword
--   - Blog: slug = primary keyword (title may differ but must include keyword)

UPDATE guardrail_templates
SET template_content = E'Title: [SEO-shaped title containing the primary keyword]\nProposed URL: /[primary-keyword-as-slug]  -- slug MUST be the primary keyword (kebab-case)\nTitle Tag: [SEO title that contains the primary keyword]\nMeta Description: [<=170 chars, includes primary keyword]\nContent Intent: [middle-of-funnel, informational/commercial]\nTarget Keyword: [primary keyword]'
WHERE content_type = 'blog' AND field_name = 'metadata';

UPDATE guardrail_templates
SET template_content = E'Title: [primary keyword verbatim]  -- title MUST equal the primary keyword\nProposed URL: /[primary-keyword-as-slug]  -- slug MUST be the primary keyword (kebab-case)\nTitle Tag: [primary keyword]  -- mirrors the keyword; brand suffix optional\nMeta Description: [<=170 chars, includes primary keyword]\nContent Intent: [bottom-of-funnel, commercial]\nTarget Keyword: [primary keyword]'
WHERE content_type = 'shoppable' AND field_name = 'metadata';
