# I18NManager
This class lies at the core of the i18n system

## Progressive i18n
`I18NManager` provides a progressive data interface. Progressive data in this case refers to the fact that the system can calculate, infer, and cache data that is missing. This is a great asset to reduce translator work, duplication and issues related to this, as well as request payloads. In essence, this lets a translator or developer provide basic data that is supposed to cover one locale fully, and then extend that with supplementary data for additional locales. For instance, if an app requires multiple English locales it's likely that there exists a lot of overlap. In certain instances, like "color" in en-US vs. "colour" in en-UK, data will differ. Thanks to progressive data, the en-UK partition may only define its own version of "color", thereby drastically reducing the amount of data that needs to be loaded.
