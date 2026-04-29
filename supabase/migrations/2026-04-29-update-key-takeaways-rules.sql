-- Update structure templates so:
--   - Blog: Key Takeaways = EXACTLY 3 bullets
--   - Shoppable: NO Key Takeaways section

UPDATE guardrail_templates
SET template_content = E'## [H1 Topic]\n\n[Opening paragraph - pain point focused]\n\n## Key Takeaways\n\n- [Takeaway 1]\n- [Takeaway 2]\n- [Takeaway 3]\n\n(EXACTLY 3 bullets — no more, no less)\n\n## [Major Section]\n\n[Content...]\n\n### [Subsection if needed]\n\n[Content...]\n\n## [Next Major Section]\n\n## [FAQ Section]\n\n### [Question 1]\n\n[Answer...]\n\n### [Question 2]\n\n[Answer...]'
WHERE content_type = 'blog' AND field_name = 'structure';

UPDATE guardrail_templates
SET template_content = E'## [H1 Topic]\n\n[Opening paragraph - pain point focused, bottom of funnel]\n\n(NO "Key Takeaways" section — shoppables go straight from intro to product/feature content)\n\n## [Major Section]\n\n[Content with embedded product mentions]\n\n### [Subsection]\n\n[Content...]\n\n## [Next Major Section]\n\n## [FAQ Section]\n\n### [Question 1]\n\n[Answer...]\n\n### [Question 2]\n\n[Answer...]'
WHERE content_type = 'shoppable' AND field_name = 'structure';
