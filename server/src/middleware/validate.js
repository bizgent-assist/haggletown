import Joi from 'joi';

// NEAR account ids: named (a.b.testnet) or 64-hex implicit accounts.
export const nearAccountId = Joi.string()
  .min(2)
  .max(64)
  .pattern(/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/);

export function validate(schemas) {
  return (req, _res, next) => {
    for (const part of ['body', 'query', 'params']) {
      if (!schemas[part]) continue;
      const { error, value } = schemas[part].validate(req[part], { stripUnknown: true });
      if (error) return next(Object.assign(new Error(error.message), { status: 400 }));
      if (part === 'body') req.body = value;
    }
    return next();
  };
}
